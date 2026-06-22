// Import Rousseau tafels + stoelen (dealer). Scrape listing → detail → foto's
// @2000px → Cloudinary. VERBORGEN + €0 (geen prijzen op Rousseau), source
// "Rousseau". Idempotent (upsert op slug) → veilig te hervatten.
//
// Dry-run 1 categorie: npx tsx scripts/import-rousseau-tafels-stoelen.ts --only=eettafels
// Apply alles:        npx tsx scripts/import-rousseau-tafels-stoelen.ts --apply
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
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const BASE = "https://www.rousseau.be";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

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

type Parsed = { name: string; width: number | null; height: number | null; depth: number | null; ref: string | null; barcode: string | null; description: string; images: string[] };

function parse(html: string, sku: string): Parsed {
  const lines = toLines(html);
  const hh = lines.findIndex((l) => l === "H-H");
  let name = hh > 0 ? lines[hh - 1] : "";
  name = name.replace(/^\s*(NEW|NIEUW|SALE|PROMO)\s*-?\s*/i, "").trim();
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
  const images = [...set].filter((u) => decodeURIComponent(u).includes(sku)).sort((a, b) => idxNum(a) - idxNum(b)).map((u) => `${BASE}${u}?w=2000&fit=max`);
  return { name, width, height, depth, ref, barcode, description, images };
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

async function main() {
  const sources = ONLY ? SOURCES.filter((s) => s.cat === ONLY || s.path.endsWith(ONLY)) : SOURCES;
  console.log(`\n═══ Rousseau tafels + stoelen — ${sources.length} bron-categorie(ën) ═══`);
  console.log(APPLY ? "MODE: APPLY (live)\n" : "MODE: dry-run\n");

  const seen = new Set<string>();
  let total = 0, created = 0;
  for (const src of sources) {
    let skus: string[] = [];
    try { skus = await listSkus(src.path); } catch (e) { console.error(`✗ listing ${src.path}: ${e instanceof Error ? e.message : e}`); continue; }
    console.log(`\n── ${src.path} → ${src.cat}  (${skus.length} SKU's) ──`);
    for (const sku of skus) {
      total++;
      let p: Parsed;
      try { p = parse(await fetchHtml(`${BASE}/nl/producten/${src.path}/${sku}`), sku); }
      catch (e) { console.error(`  ✗ ${sku}: ${e instanceof Error ? e.message : e}`); await sleep(200); continue; }
      let slug = slugify(p.name) || `rousseau-${slugify(sku)}`;
      if (seen.has(slug)) slug = `${slug}-${slugify(sku)}`;
      seen.add(slug);
      const dim = p.width && p.depth && p.height ? `B${p.width}×D${p.depth}×H${p.height}` : (p.height ? `H${p.height}` : "—");
      if (!APPLY) {
        console.log(`  ${p.images.length ? "✓" : "⚠"} ${sku.padEnd(9)} ${String(p.images.length).padStart(2)}f ${dim.padEnd(15)} ${p.name.slice(0, 50)}`);
        await sleep(150); continue;
      }
      // APPLY — upload foto's, dan upsert
      const uploaded: { url: string; w: number; h: number }[] = [];
      for (let i = 0; i < p.images.length; i++) {
        try {
          const r = await cloudinary.uploader.upload(p.images[i], { public_id: `mokka/${src.cat}/${slug}/${String(i + 1).padStart(2, "0")}`, overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto" });
          uploaded.push({ url: r.secure_url, w: r.width, h: r.height });
        } catch { /* skip foto */ }
      }
      if (!uploaded.length) { console.log(`  ⏭ ${sku} (geen foto's)`); await sleep(150); continue; }
      const specs: Record<string, string> = { Serie: p.name.split(/['']/)[1]?.trim() || "" };
      if (!specs.Serie) delete specs.Serie;
      if (p.width && p.depth && p.height) specs.Afmetingen = `B ${p.width} × D ${p.depth} × H ${p.height} cm`;
      else if (p.height) specs.Afmetingen = `H ${p.height} cm`;
      if (p.barcode) specs.EAN = p.barcode;
      if (p.ref) specs.Artikelnummer = p.ref;
      const data = {
        name: p.name, description: p.description || `${p.name} — Rousseau-collectie.`,
        price: 0, category: src.cat, images: JSON.stringify(uploaded), specs: JSON.stringify(specs),
        source: "Rousseau", hidden: true, stock: 10,
      };
      await prisma.product.upsert({ where: { slug }, update: data, create: { slug, ...data } });
      created++;
      if (created % 10 === 0) console.log(`  … ${created} aangemaakt`);
      await sleep(150);
    }
  }
  console.log(APPLY ? `\n✅ Klaar — ${created}/${total} producten (verborgen, €0, source Rousseau).` : `\nDry-run klaar — ${total} producten gezien.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
