/**
 * Controleert bij de leveranciersbronnen welke ZICHTBARE producten uitverkocht
 * zijn en zet die op voorraad 0 (de shop toont dan "Uitverkocht"). Verbergt
 * niets en raakt prijzen niet.
 *
 * Bronnen:
 *  - Great Home: live app4sales-API (StockColor red = uitverkocht). Matching op
 *    slug van de bronbeschrijving, via SlugRedirect (hernoemde producten) en
 *    via woordsignatuur (zelfde aanpak als scripts/sync-greathome.ts).
 *  - Rousseau: detailpagina per product (Artikelnummer in specs); status uit de
 *    variantentabel (zelfde parser als scripts/import-rousseau-tafels-stoelen.ts).
 *  - LivingFurn en overige bronnen (NIVE, Saltanat, MUMZA, One World, Bambi/BSS,
 *    Twenty Bedding, Mokka HOME): geen online voorraadbron → worden gerapporteerd,
 *    niet gewijzigd.
 *
 *   npx tsx scripts/sync-stock-status.ts              # dry-run (rapport)
 *   npx tsx scripts/sync-stock-status.ts --apply      # zet uitverkochte producten op stock 0
 *   npx tsx scripts/sync-stock-status.ts --source=rousseau|greathome
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ONLY = args.find((a) => a.startsWith("--source="))?.slice(9);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const sig = (s: string) => [...new Set(slugify(s).split("-").filter(Boolean))].sort().join("-");

type Row = { id: string; slug: string; name: string; category: string; source: string | null; specs: string | null; colorName: string | null; stock: number; images: string };
type Verdict = { row: Row; inStock: boolean | null; note: string };

// ── Great Home ────────────────────────────────────────────────────────
const GH_API = "https://api.app4sales.net/greathome/api/portal4sales/v2/catalog";
const GH_HEADERS = {
  "Content-Type": "application/json",
  OptP4S: "V2",
  OptCustomerCode: "1241",
  Authorization: "Basic " + Buffer.from("1241:t164v5K").toString("base64"),
};
type GhItem = { ItemCode: string; Description: string; StockColor: string; EANCode?: string };

/** Mapnaam in de Cloudinary-URL van de eerste foto = oorspronkelijke bron-slug. */
function imageFolder(images: string): string | null {
  try {
    const arr = JSON.parse(images) as unknown[];
    const first = arr[0];
    const url = typeof first === "string" ? first : (first as { url?: string })?.url;
    const m = url?.match(/\/mokka\/[^/]+\/([^/]+)\/[^/]+$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function fetchGreatHome(): Promise<GhItem[]> {
  const items: GhItem[] = [];
  for (let page = 0; page < 20; page++) {
    const res = await fetch(GH_API, {
      method: "POST",
      headers: GH_HEADERS,
      body: JSON.stringify({ Edition: "", Filters: [], SearchText: "", Language: "nl", HasNoFiltersOrLinkedProducts: false, Page: page, PageSize: 300 }),
    });
    if (!res.ok) throw new Error(`Great Home API ${res.status}`);
    const json = (await res.json()) as { Items: GhItem[]; ItemCount: number };
    items.push(...json.Items);
    if (items.length >= json.ItemCount || json.Items.length === 0) break;
  }
  return items;
}

/** Tokens gelijk als identiek, of als de één een prefix (≥ 4 tekens) van de ander is. */
function tokenEq(a: string, b: string): boolean {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 4 && l.startsWith(s);
}
function similarity(a: string[], b: string[]): number {
  const matched = a.filter((t) => b.some((u) => tokenEq(t, u))).length;
  return matched / Math.max(a.length, b.length);
}
function fuzzyMatch(candidates: string[], items: GhItem[]): GhItem | null {
  let best: { it: GhItem; score: number } | null = null;
  let second = 0;
  for (const c of candidates) {
    const ct = slugify(c).split("-").filter(Boolean);
    if (ct.length < 3) continue;
    for (const it of items) {
      const score = similarity(ct, slugify(it.Description).split("-").filter(Boolean));
      if (!best || score > best.score) {
        second = best?.score ?? 0;
        best = { it, score };
      } else if (score > second && it !== best.it) {
        second = score;
      }
    }
  }
  return best && best.score >= 0.8 && best.score > second ? best.it : null;
}

async function checkGreatHome(rows: Row[]): Promise<Verdict[]> {
  const items = await fetchGreatHome();
  console.log(`Great Home: ${items.length} artikelen in de bron`);
  const bySlug = new Map<string, GhItem>();
  const bySig = new Map<string, GhItem | null>();
  const byCode = new Map<string, GhItem>();
  const byEan = new Map<string, GhItem>();
  for (const it of items) {
    const s = slugify(it.Description);
    if (!bySlug.has(s)) bySlug.set(s, it);
    const k = sig(it.Description);
    bySig.set(k, bySig.has(k) ? null : it);
    byCode.set(it.ItemCode, it);
    if (it.EANCode) byEan.set(it.EANCode, it);
  }
  // Hernoemde producten: oude slug (= bronbeschrijving) → productId.
  const redirects = await prisma.slugRedirect.findMany({ select: { oldSlug: true, productId: true } });
  const oldSlugsByProduct = new Map<string, string[]>();
  for (const r of redirects) oldSlugsByProduct.set(r.productId, [...(oldSlugsByProduct.get(r.productId) ?? []), r.oldSlug]);

  const match = (row: Row): { it: GhItem; fuzzy: boolean } | null => {
    // 1. Artikelnummer/EAN uit de specs (imports via de API slaan die op).
    const code = specOf(row, "Artikelnummer");
    if (code && byCode.has(code)) return { it: byCode.get(code)!, fuzzy: false };
    const ean = specOf(row, "EAN");
    if (ean && byEan.has(ean)) return { it: byEan.get(ean)!, fuzzy: false };
    // 2. Huidige slug, oude slugs (hernoemd) en de Cloudinary-mapnaam.
    const folder = imageFolder(row.images);
    const candidates = [row.slug, ...(oldSlugsByProduct.get(row.id) ?? []), ...(folder ? [folder] : [])];
    for (const c of candidates) {
      const hit = bySlug.get(c);
      if (hit) return { it: hit, fuzzy: false };
    }
    for (const c of candidates) {
      const hit = bySig.get(sig(c));
      if (hit) return { it: hit, fuzzy: false };
    }
    // 3. Fuzzy: bronbeschrijvingen veranderen soms licht ("PANDO" vs "PANDORA",
    //    extra spaties). Alleen accepteren bij één duidelijke beste kandidaat.
    const f = fuzzyMatch(candidates, items);
    return f ? { it: f, fuzzy: true } : null;
  };

  return rows.map((row) => {
    const m = match(row);
    if (!m) return { row, inStock: null, note: "niet gevonden in bron" };
    const inStock = m.it.StockColor !== "red";
    const how = m.fuzzy ? ` [fuzzy ← "${m.it.Description}"]` : "";
    return { row, inStock, note: `${m.it.ItemCode} ${m.it.StockColor}${how}` };
  });
}

// ── Rousseau ──────────────────────────────────────────────────────────
const RS_BASE = "https://www.rousseau.be/nl/producten";
const RS_PATHS: Record<string, string[]> = {
  eettafels: ["eetkamer/eettafels"],
  salontafels: ["woonkamer/salontafels"],
  bijzettafels: ["woonkamer/bijzettafels", "woonkamer/consoletafels"],
  eetkamerstoelen: ["eetkamer/eetkamerstoelen", "eetkamer/eetkamerstoelen-met-armleuningen", "eetkamer/houten-stoelen", "eetkamer/draaibare-stoelen"],
  bedden: ["slaapkamer/bedden"],
  kledingkasten: ["slaapkamer/kledingkasten"],
  "tv-meubels": ["woonkamer/tv-meubels", "berging/tv-meubels"],
  kapstokken: ["berging/kapstokken"],
  schoenenkasten: ["berging/schoenenkasten"],
};
const STATUS_RE = /^(stock|lage voorraad|op voorraad|uitverkocht|niet (meer )?leverbaar|beschikbaar voor dropshipping|\d{1,2}\/\d{1,2}\/\d{4})$/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}
function toLines(html: string): string[] {
  const t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, "\n");
  return decodeEntities(t).split("\n").map((s) => s.trim()).filter(Boolean);
}

/** Status van de best passende variantrij (kleur uit naam/colorName, breedte uit specs). */
function rousseauStatus(lines: string[], name: string, width: number | null): { status: string | null; inStock: boolean | null } {
  const rows: { color: string; label: string; status: string }[] = [];
  const start = lines.findIndex((l) => l === "REF.");
  if (start < 0) return { status: null, inStock: null };
  const endIdx = lines.findIndex((l, i) => i > start && /^Productinformatie$/i.test(l));
  const end = endIdx > 0 ? endIdx : lines.length;
  for (let i = start + 1; i < end - 1; i++) {
    if (STATUS_RE.test(lines[i]) || !STATUS_RE.test(lines[i + 1]) || /^nieuw$/i.test(lines[i])) continue;
    const label = lines[i];
    rows.push({ color: label.split(/\s+-\s+/)[0].trim().toLowerCase(), label: label.toLowerCase(), status: lines[i + 1] });
    i++;
  }
  if (!rows.length) return { status: null, inStock: null };
  const n = name.toLowerCase();
  const hasWord = (w: string) => new RegExp(`(^|[^a-z])${escapeRe(w)}([^a-z]|$)`).test(n);
  let cands = rows;
  if (rows.length > 1) {
    const scored = rows
      .map((r) => ({ r, score: r.color.split(/\s+/).filter((w) => w.length > 1 && hasWord(w)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.r.color.length - a.r.color.length);
    cands = scored.length ? scored.filter((x) => x.score === scored[0].score).map((x) => x.r) : rows;
  }
  if (cands.length > 1 && width) {
    const bySize = cands.filter((r) => new RegExp(`(^|[^0-9])${width}([^0-9]|$)`).test(r.label));
    if (bySize.length) cands = bySize;
  }
  const statuses = new Set(cands.map((r) => r.status.toLowerCase()));
  if (statuses.size > 1) return { status: [...statuses].join(" / "), inStock: null };
  const status = cands[0].status;
  const isOut = /\d{1,2}\/\d{1,2}\/\d{4}|uitverkocht|niet (meer )?leverbaar/i.test(status);
  const isIn = /stock|voorraad|dropshipping/i.test(status) && !isOut;
  return { status, inStock: isIn ? true : isOut ? false : null };
}

function specOf(row: Row, key: string): string | null {
  try {
    const v = JSON.parse(row.specs || "{}")[key];
    return v ? String(v) : null;
  } catch {
    return null;
  }
}

async function checkRousseau(rows: Row[]): Promise<Verdict[]> {
  const out: Verdict[] = [];
  let i = 0;
  for (const row of rows) {
    i++;
    const sku = specOf(row, "Artikelnummer");
    if (!sku) {
      out.push({ row, inStock: null, note: "geen artikelnummer" });
      continue;
    }
    // Eerst de paden van de eigen categorie, daarna alle andere: Rousseau
    // hangt bv. consoles onder consoletafels en kleine salontafels onder
    // salontafels, terwijl wij ze als tv-meubel/bijzettafel verkopen.
    const own = RS_PATHS[row.category] ?? [];
    const paths = [...own, ...Object.values(RS_PATHS).flat().filter((p) => !own.includes(p))];
    const width = Number(specOf(row, "Afmetingen")?.match(/B\s*(\d+)/)?.[1] ?? 0) || null;
    const nameForMatch = `${row.name} ${row.colorName ?? ""}`;
    let verdict: Verdict | null = null;
    for (const path of paths) {
      try {
        const res = await fetch(`${RS_BASE}/${path}/${sku}`, { headers: { "User-Agent": UA } });
        if (!res.ok) continue;
        const html = await res.text();
        if (/<title>[^<]*404|Not Found/i.test(html) || html.length < 5000) continue;
        const st = rousseauStatus(toLines(html), nameForMatch, width);
        verdict = { row, inStock: st.inStock, note: `${sku} ${st.status ?? "status onbekend"}` };
        break;
      } catch (err) {
        verdict = { row, inStock: null, note: `fout: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    out.push(verdict ?? { row, inStock: false, note: `${sku} pagina weg (404)` });
    if (i % 25 === 0) console.log(`  Rousseau ${i}/${rows.length}…`);
    await sleep(200);
  }
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const rows: Row[] = await prisma.product.findMany({
    where: { hidden: false, deletedAt: null },
    select: { id: true, slug: true, name: true, category: true, source: true, specs: true, colorName: true, stock: true, images: true },
    orderBy: { slug: "asc" },
  });
  const norm = (s: string | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const gh = rows.filter((r) => norm(r.source) === "great home");
  const rs = rows.filter((r) => norm(r.source) === "rousseau");
  const other = rows.filter((r) => !gh.includes(r) && !rs.includes(r));

  const verdicts: Verdict[] = [];
  if (!ONLY || ONLY === "greathome") verdicts.push(...(await checkGreatHome(gh)));
  if (!ONLY || ONLY === "rousseau") verdicts.push(...(await checkRousseau(rs)));

  const soldOut = verdicts.filter((v) => v.inStock === false && v.row.stock > 0);
  const backInStock = verdicts.filter((v) => v.inStock === true && v.row.stock <= 0);
  const unknown = verdicts.filter((v) => v.inStock === null);

  console.log(`\nGecontroleerd: Great Home ${gh.length}, Rousseau ${rs.length}. Niet controleerbaar (geen online voorraadbron): ${other.length}`);
  const bySource = new Map<string, number>();
  for (const r of other) bySource.set(r.source ?? "(geen bron)", (bySource.get(r.source ?? "(geen bron)") ?? 0) + 1);
  console.log("  " + [...bySource.entries()].map(([s, n]) => `${s}: ${n}`).join(", "));

  console.log(`\nUITVERKOCHT bij de bron, nu nog op voorraad in de shop: ${soldOut.length}`);
  for (const v of soldOut) console.log(`  ${v.row.category}/${v.row.slug}  (stock ${v.row.stock}) — ${v.note}`);
  console.log(`\nWeer op voorraad bij de bron, in de shop op 0 (niet gewijzigd): ${backInStock.length}`);
  for (const v of backInStock) console.log(`  ${v.row.category}/${v.row.slug} — ${v.note}`);
  console.log(`\nOnbekend/niet gematcht: ${unknown.length}`);
  for (const v of unknown.slice(0, 40)) console.log(`  ${v.row.category}/${v.row.slug} — ${v.note}`);
  if (unknown.length > 40) console.log(`  … en ${unknown.length - 40} meer`);

  if (!APPLY) {
    console.log("\nDRY-RUN (gebruik --apply om uitverkochte producten op voorraad 0 te zetten)");
    return;
  }
  const res = await prisma.product.updateMany({ where: { id: { in: soldOut.map((v) => v.row.id) } }, data: { stock: 0 } });
  console.log(`\nTOEGEPAST: ${res.count} producten op voorraad 0 gezet.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
