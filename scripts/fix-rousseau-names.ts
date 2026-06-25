// Herstelt Rousseau-producten waarvan de naam "Beschikbaar voor dropshipping"
// werd (parse-fout). Haalt de juiste naam uit de listing-pagina's (article-
// name, betrouwbaar) op basis van het Artikelnummer (= URL-sku) en zet naam +
// nette slug + Serie.
//
// Dry-run: npx tsx scripts/fix-rousseau-names.ts
// Apply:   npx tsx scripts/fix-rousseau-names.ts --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BASE = "https://www.rousseau.be";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const PATHS = [
  "eetkamer/eettafels", "woonkamer/salontafels", "woonkamer/bijzettafels", "woonkamer/consoletafels",
  "eetkamer/eetkamerstoelen", "eetkamer/eetkamerstoelen-met-armleuningen", "eetkamer/houten-stoelen", "eetkamer/draaibare-stoelen",
];
function decode(s: string) {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function buildMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const path of PATHS) {
    const res = await fetch(`${BASE}/nl/producten/${path}`, { headers: { "User-Agent": UA } });
    if (!res.ok) { console.error(`✗ listing ${path}: HTTP ${res.status}`); continue; }
    const html = await res.text();
    const skus: string[] = [];
    const reSku = new RegExp(`producten/${path}/([0-9][0-9a-z-]*)"\\s+class="group`, "g");
    let m: RegExpExecArray | null;
    while ((m = reSku.exec(html))) skus.push(m[1]);
    const names: string[] = [];
    const reName = /article-name">\s*([^<]+?)\s*</g;
    while ((m = reName.exec(html))) names.push(decode(m[1]).trim());
    if (skus.length !== names.length) console.error(`  ⚠ ${path}: ${skus.length} sku's vs ${names.length} namen (mismatch)`);
    const n = Math.min(skus.length, names.length);
    for (let i = 0; i < n; i++) if (!map.has(skus[i])) map.set(skus[i], names[i]);
  }
  return map;
}

async function main() {
  const map = await buildMap();
  console.log(`SKU→naam-kaart: ${map.size} entries\n`);

  const bad = await p.product.findMany({ where: { source: "Rousseau", name: "Beschikbaar voor dropshipping", deletedAt: null }, select: { id: true, slug: true, specs: true } });
  const allSlugs = new Set((await p.product.findMany({ where: { deletedAt: null }, select: { slug: true } })).map((x) => x.slug));

  let fixed = 0, notFound = 0;
  const sample: string[] = [];
  for (const b of bad) {
    let specs: Record<string, string> = {}; try { specs = JSON.parse(b.specs || "{}"); } catch {}
    const sku = specs.Artikelnummer;
    const raw = sku ? map.get(sku) : undefined;
    if (!raw) { notFound++; continue; }
    const name = raw.replace(/^\s*(NEW|NIEUW|SALE|PROMO)\s*[-–]\s*/i, "").replace(/\s{2,}/g, " ").trim();
    let slug = slugify(name);
    if (slug !== b.slug && allSlugs.has(slug)) slug = `${slug}-${slugify(sku!)}`;
    allSlugs.delete(b.slug); allSlugs.add(slug);
    const serie = name.split(/'/)[1]?.trim();
    if (serie && !specs.Serie) specs.Serie = serie;
    if (sample.length < 14) sample.push(`  ${sku!.padEnd(9)} ${name}`);
    if (APPLY) await p.product.update({ where: { id: b.id }, data: { name, slug, specs: JSON.stringify(specs) } });
    fixed++;
  }
  console.log(`Foute namen: ${bad.length} · hersteld: ${fixed} · sku niet in listing: ${notFound}`);
  console.log(`\nVoorbeelden:\n${sample.join("\n")}`);
  console.log(APPLY ? "\n✅ Toegepast." : "\n(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
