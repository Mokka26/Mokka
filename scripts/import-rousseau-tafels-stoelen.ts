// Import Rousseau tafels + stoelen (dealer). Scrape listing → detail → foto's
// @2000px → Cloudinary. VERBORGEN + €0 (geen prijzen op Rousseau), source
// "Rousseau". Idempotent (upsert op slug) → veilig te hervatten.
//
// Alleen NIEUWE SKU's (Artikelnummer nog niet in DB) en alleen producten die
// op de bron OP VOORRAAD zijn ("Stock" / "Lage voorraad"). Een leverdatum
// (bv. 31/10/2026) = nog niet binnen → overgeslagen.
//
// Dry-run 1 categorie: npx tsx scripts/import-rousseau-tafels-stoelen.ts --only=eettafels
// Apply:               npx tsx scripts/import-rousseau-tafels-stoelen.ts --only=eettafels --apply
// Flags: --force (ook bestaande SKU's opnieuw schrijven — reset prijs/zichtbaarheid!)
//        --include-incoming (ook producten met leverdatum, als stock 0)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const INCLUDE_INCOMING = process.argv.includes("--include-incoming");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const BASE = "https://www.rousseau.be";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
// Zelfde levertijd als scripts/set-delivery-times.ts voor Rousseau.
const DELIVERY = "Binnen 5 werkdagen";

// Rousseau-listing → onze categorie
const SOURCES: { path: string; cat: string }[] = [
  { path: "eetkamer/eettafels", cat: "eettafels" },
  { path: "woonkamer/salontafels", cat: "salontafels" },
  { path: "woonkamer/bijzettafels", cat: "bijzettafels" },
  { path: "woonkamer/consoletafels", cat: "bijzettafels" },
  { path: "eetkamer/eetkamerstoelen", cat: "eetkamerstoelen" },
  { path: "eetkamer/eetkamerstoelen-met-armleuningen", cat: "eetkamerstoelen" },
  { path: "eetkamer/houten-stoelen", cat: "eetkamerstoelen" },
  { path: "eetkamer/draaibare-stoelen", cat: "eetkamerstoelen" },
];

function decodeEntities(s: string): string {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}
function toLines(html: string): string[] {
  let t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<[^>]+>/g, "\n");
  return decodeEntities(t).split("\n").map((s) => s.trim()).filter(Boolean);
}
function digits(s: string | undefined): number | null {
  if (!s) return null; const m = s.match(/\d+/); return m ? parseInt(m[0], 10) : null;
}
function afterLabel(lines: string[], label: string): string | undefined {
  const i = lines.findIndex((l) => l === label); return i >= 0 ? lines[i + 1] : undefined;
}
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const cleanName = (s: string) =>
  decodeEntities(s).replace(/\s+/g, " ").replace(/^\s*(NEW|NIEUW|SALE|PROMO)\s*-?\s*/i, "").trim();

// Voorraadstatus zoals Rousseau die in de variantentabel toont.
const STATUS_RE = /^(stock|lage voorraad|op voorraad|uitverkocht|niet (meer )?leverbaar|beschikbaar voor dropshipping|\d{1,2}\/\d{1,2}\/\d{4})$/i;
type Stock = { status: string | null; inStock: boolean | null };
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function stockFor(lines: string[], name: string, width: number | null): Stock {
  // Variantentabel: regels "Kleur - maat" (of alleen "Kleur") direct gevolgd door een status.
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
    // Geen kleur in de rijen (alleen maten, bv. "180x90cm")? Dan alle rijen, maat beslist.
    cands = scored.length ? scored.filter((x) => x.score === scored[0].score).map((x) => x.r) : rows;
  }
  if (cands.length > 1 && width) {
    const bySize = cands.filter((r) => new RegExp(`(^|[^0-9])${width}([^0-9]|$)`).test(r.label));
    if (bySize.length) cands = bySize;
  }
  if (!cands.length) return { status: null, inStock: null };
  const statuses = new Set(cands.map((r) => r.status.toLowerCase()));
  if (statuses.size > 1) return { status: [...statuses].join(" / "), inStock: null };
  const status = cands[0].status;
  const isOut = /\d{1,2}\/\d{1,2}\/\d{4}|uitverkocht|niet (meer )?leverbaar/i.test(status);
  const isIn = /stock|voorraad|dropshipping/i.test(status) && !isOut;
  return { status, inStock: isIn ? true : isOut ? false : null };
}

type Parsed = { name: string; width: number | null; height: number | null; depth: number | null; ref: string | null; barcode: string | null; description: string; images: string[]; stock: Stock };

function parse(html: string, sku: string): Parsed {
  const lines = toLines(html);
  // Naam: <h1> is betrouwbaar; fallback = regel vóór "H-H" (oude layout).
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "";
  const hh = lines.findIndex((l) => l === "H-H");
  let name = cleanName(h1);
  if (!name && hh > 0) name = cleanName(lines[hh - 1]);
  if (/^beschikbaar voor dropshipping$/i.test(name)) name = "";
  const height = digits(afterLabel(lines, "H-H"));
  const width = digits(afterLabel(lines, "B-L"));
  const depth = digits(afterLabel(lines, "D-P"));
  const ref = afterLabel(lines, "REF.") ?? null;
  const barcode = afterLabel(lines, "Barcode") ?? null;
  let description = "";
  const ti = lines.findIndex((l) => /^Technische informatie$/i.test(l));
  if (ti >= 0) {
    const oi = lines.findIndex((l, idx) => idx > ti && /^Onderhoudsinformatie$/i.test(l));
    const end = oi > ti ? oi : Math.min(ti + 6, lines.length);
    description = lines.slice(ti + 1, end).join(" ").replace(/\s+/g, " ").trim();
    description = description.split(/Onderhoudsinformatie/i)[0].trim();
  }
  const set = new Set<string>();
  const re = /\/upload\/[0-9a-f-]{36}\/[^"'\s>]+?\.(?:jpg|jpeg|png)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[0]);
  const idxNum = (u: string) => { const n = decodeURIComponent(u).match(/(\d+)(?=\.(?:jpg|jpeg|png)$)/i); return n ? parseInt(n[1], 10) : 999; };
  // Foto-bestandsnamen bevatten meestal de volledige SKU ("3400-8"); soms alleen
  // het basisnummer ("Rousseau 3920 salontafel … Quinn 1.jpg" bij SKU 3920-1).
  const baseSku = sku.replace(/-\d+$/, "");
  let matched = [...set].filter((u) => decodeURIComponent(u).includes(sku));
  if (!matched.length) matched = [...set].filter((u) => new RegExp(`(^|[^0-9])${baseSku}([^0-9]|$)`).test(decodeURIComponent(u)));
  const images = matched.sort((a, b) => idxNum(a) - idxNum(b)).map((u) => `${BASE}${u}?w=2000&fit=max`);
  return { name, width, height, depth, ref, barcode, description, images, stock: stockFor(lines, name, width) };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
async function listSkus(path: string): Promise<string[]> {
  const html = await fetchHtml(`${BASE}/nl/producten/${path}`);
  const re = new RegExp(`producten/${path}/([0-9][0-9a-z-]*)`, "g");
  const set = new Set<string>(); let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[1]);
  return [...set];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function existingRousseau(): Promise<{ skus: Set<string>; slugs: Set<string> }> {
  const rows = await prisma.product.findMany({ where: { source: "Rousseau", deletedAt: null }, select: { slug: true, specs: true } });
  const skus = new Set<string>(); const slugs = new Set<string>();
  for (const r of rows) {
    slugs.add(r.slug);
    try { const s = JSON.parse(r.specs || "{}").Artikelnummer; if (s) skus.add(String(s)); } catch { /* geen specs */ }
  }
  return { skus, slugs };
}

async function main() {
  const sources = ONLY ? SOURCES.filter((s) => s.cat === ONLY || s.path.endsWith(ONLY)) : SOURCES;
  console.log(`\n═══ Rousseau tafels + stoelen — ${sources.length} bron-categorie(ën) ═══`);
  console.log(APPLY ? "MODE: APPLY (live)" : "MODE: dry-run");
  console.log(`${FORCE ? "FORCE: bestaande SKU's worden overschreven" : "Bestaande SKU's worden overgeslagen"} · ${INCLUDE_INCOMING ? "incl. nog-niet-leverbaar (stock 0)" : "alleen op voorraad"}\n`);

  const existing = await existingRousseau();
  const seen = new Set<string>(existing.slugs);
  let total = 0, created = 0, skippedExisting = 0, skippedStock = 0, unknownStock = 0;
  const incoming: string[] = [], unknown: string[] = [];
  for (const src of sources) {
    let skus: string[] = [];
    try { skus = await listSkus(src.path); } catch (e) { console.error(`✗ listing ${src.path}: ${e instanceof Error ? e.message : e}`); continue; }
    console.log(`\n── ${src.path} → ${src.cat}  (${skus.length} SKU's) ──`);
    for (const sku of skus) {
      total++;
      if (!FORCE && existing.skus.has(sku)) { skippedExisting++; continue; }
      let p: Parsed;
      try { p = parse(await fetchHtml(`${BASE}/nl/producten/${src.path}/${sku}`), sku); }
      catch (e) { console.error(`  ✗ ${sku}: ${e instanceof Error ? e.message : e}`); await sleep(200); continue; }
      const dim = p.width && p.depth && p.height ? `B${p.width}×D${p.depth}×H${p.height}` : (p.height ? `H${p.height}` : "—");
      const st = p.stock.inStock === true ? `✅ ${p.stock.status}` : p.stock.inStock === false ? `🔴 ${p.stock.status}` : `⚠ ${p.stock.status ?? "geen match"}`;
      console.log(`  ${p.images.length ? " " : "⚠"} ${sku.padEnd(9)} ${String(p.images.length).padStart(2)}f ${dim.padEnd(15)} ${st.padEnd(22)} ${p.name.slice(0, 60)}`);
      if (p.stock.inStock === false) { incoming.push(`${sku} (${p.stock.status}) ${p.name}`); if (!INCLUDE_INCOMING) { skippedStock++; await sleep(150); continue; } }
      if (p.stock.inStock === null) { unknown.push(`${sku} (${p.stock.status ?? "geen match"}) ${p.name}`); unknownStock++; await sleep(150); continue; }
      if (!p.name) { console.log(`  ⏭ ${sku} (geen naam)`); await sleep(150); continue; }
      let slug = slugify(p.name) || `rousseau-${slugify(sku)}`;
      if (seen.has(slug)) slug = `${slug}-${slugify(sku)}`;
      seen.add(slug);
      if (!APPLY) { await sleep(150); continue; }
      // APPLY — upload foto's, dan upsert
      const uploaded: { url: string; w: number; h: number }[] = [];
      for (let i = 0; i < p.images.length; i++) {
        try {
          const r = await cloudinary.uploader.upload(p.images[i], { public_id: `mokka/${src.cat}/${slug}/${String(i + 1).padStart(2, "0")}`, overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto" });
          uploaded.push({ url: r.secure_url, w: r.width, h: r.height });
        } catch { /* skip foto */ }
      }
      if (!uploaded.length) { console.log(`  ⏭ ${sku} (geen foto's)`); await sleep(150); continue; }
      const specs: Record<string, string> = { Serie: p.name.split(/['’]/)[1]?.trim() || "" };
      if (!specs.Serie) delete specs.Serie;
      if (p.width && p.depth && p.height) specs.Afmetingen = `B ${p.width} × D ${p.depth} × H ${p.height} cm`;
      else if (p.height) specs.Afmetingen = `H ${p.height} cm`;
      if (p.barcode) specs.EAN = p.barcode;
      if (p.ref) specs.Artikelnummer = p.ref;
      const stock = p.stock.inStock === false ? 0 : /lage voorraad/i.test(p.stock.status ?? "") ? 3 : 10;
      const data = {
        name: p.name, description: p.description || `${p.name} — Rousseau-collectie.`,
        price: 0, category: src.cat, images: JSON.stringify(uploaded), specs: JSON.stringify(specs),
        source: "Rousseau", hidden: true, stock, deliveryTime: DELIVERY,
      };
      await prisma.product.upsert({ where: { slug }, update: data, create: { slug, ...data } });
      created++;
      if (created % 10 === 0) console.log(`  … ${created} aangemaakt`);
      await sleep(150);
    }
  }
  console.log(`\nGezien: ${total} · al in DB: ${skippedExisting} · nog niet leverbaar: ${skippedStock} · voorraad onbekend: ${unknownStock}`);
  if (incoming.length) console.log(`\nNog niet leverbaar (leverdatum op bron):\n  ${incoming.join("\n  ")}`);
  if (unknown.length) console.log(`\nVoorraad niet te bepalen (handmatig checken):\n  ${unknown.join("\n  ")}`);
  console.log(APPLY ? `\n✅ Klaar — ${created} producten aangemaakt (verborgen, €0, source Rousseau).` : `\nDry-run klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
