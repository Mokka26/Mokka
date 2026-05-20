/**
 * Merge duplicate banken-slugs naar hun juiste parent.
 * Voor elke (source, target): voeg source's images toe aan target, delete source.
 * Cloudinary assets blijven bestaan (kunnen later opgeruimd).
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface ImageEntry { url: string; w?: number; h?: number }

// (source-slug → target-slug) — source wordt geüpsamenvoegd in target en gedelete
const MERGES: Array<{ source: string; target: string }> = [
  { source: "americano-1-bank", target: "americano-bank" },
  { source: "bella-1-bank",      target: "bella-bank" },
  { source: "ares-u1-bank",      target: "ares-u-bank" },
  { source: "ares-u2-bank",      target: "ares-u-bank" },
];

function dedupeImages(arr: ImageEntry[]): ImageEntry[] {
  const seen = new Set<string>();
  const out: ImageEntry[] = [];
  for (const img of arr) {
    if (!img.url || seen.has(img.url)) continue;
    seen.add(img.url);
    out.push(img);
  }
  return out;
}

let merged = 0;
let skipped = 0;

for (const { source, target } of MERGES) {
  const src = await prisma.product.findUnique({ where: { slug: source } });
  const tgt = await prisma.product.findUnique({ where: { slug: target } });

  if (!src) {
    console.log(`  ${source}: skip — bestaat niet`);
    skipped++;
    continue;
  }
  if (!tgt) {
    console.log(`  ${source} → ${target}: target ontbreekt, rename ipv merge`);
    await prisma.product.update({
      where: { slug: source },
      data: { slug: target },
    });
    merged++;
    continue;
  }

  // Merge images
  let srcImgs: ImageEntry[] = [];
  let tgtImgs: ImageEntry[] = [];
  try { srcImgs = JSON.parse(src.images) ?? []; } catch {}
  try { tgtImgs = JSON.parse(tgt.images) ?? []; } catch {}
  const combined = dedupeImages([...tgtImgs, ...srcImgs]);

  await prisma.product.update({
    where: { slug: target },
    data: { images: JSON.stringify(combined) },
  });

  await prisma.product.delete({ where: { slug: source } });
  console.log(`  ${source} → ${target}: ${srcImgs.length} foto(s) toegevoegd, source verwijderd. Target heeft nu ${combined.length} foto(s).`);
  merged++;
}

console.log(`\n${merged} gemerged, ${skipped} overgeslagen`);

// Toon eindstand
interface Row { slug: string; name: string; img_count: number }
const recent = await prisma.$queryRaw<Row[]>`
  SELECT slug, name,
    jsonb_array_length(images::jsonb) as img_count
  FROM "Product"
  WHERE category IN ('banken','hoekbanken') AND hidden = false
    AND (slug LIKE 'americano%' OR slug LIKE 'bella%' OR slug LIKE 'ares%')
  ORDER BY slug
`;
console.log("\n=== Affected banken na merge ===");
for (const r of recent) console.log(`  ${r.slug.padEnd(20)} ${String(r.img_count).padStart(2)} foto(s) — ${r.name}`);

await prisma.$disconnect();
