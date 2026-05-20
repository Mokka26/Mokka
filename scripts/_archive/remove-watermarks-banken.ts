/**
 * Verwijder watermarks van wetransfer-banken via Cloudinary e_gen_remove.
 * Modificeert image URLs in DB om de transformatie te triggeren bij eerste request.
 *
 * Idempotent: skipt URLs die al e_gen_remove bevatten.
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface ImageEntry { url: string; w?: number; h?: number }

const REMOVE_PROMPT = encodeURIComponent("text watermark logo brand name overlay").replace(/%2C/g, "%20");

function addGenRemove(url: string): string {
  if (!url.includes("/upload/")) return url;
  if (url.includes("e_gen_remove")) return url;
  // Insert e_gen_remove transformatie direct na /upload/
  return url.replace("/upload/", `/upload/e_gen_remove:prompt_(${REMOVE_PROMPT})/`);
}

const products = await prisma.product.findMany({
  where: {
    category: { in: ["banken", "hoekbanken"] },
    // alleen zichtbare (de wetransfer imports)
  },
  select: { id: true, slug: true, name: true, images: true },
});

// Filter alleen visible — via raw query om hidden veld te checken (Prisma client niet regenerate)
const visible = await prisma.$queryRaw<Array<{ id: string; slug: string; name: string; images: string }>>`
  SELECT id, slug, name, images FROM "Product"
  WHERE category IN ('banken','hoekbanken') AND hidden = false
`;

console.log(`Process ${visible.length} zichtbare banken/hoekbanken voor watermark-removal\n`);

let updated = 0;
let skipped = 0;
for (const p of visible) {
  let imgs: ImageEntry[] = [];
  try {
    imgs = JSON.parse(p.images);
    if (!Array.isArray(imgs)) imgs = [];
  } catch { continue; }

  if (imgs.length === 0) { skipped++; continue; }

  const newImgs = imgs.map((img) => ({ ...img, url: addGenRemove(img.url) }));
  const changed = newImgs.some((img, i) => img.url !== imgs[i].url);

  if (!changed) {
    skipped++;
    continue;
  }

  await prisma.product.update({
    where: { id: p.id },
    data: { images: JSON.stringify(newImgs) },
  });
  console.log(`  ${p.slug.padEnd(35)} ${newImgs.length} foto(s) geüpdate`);
  updated++;
}

console.log(`\n${updated} producten geüpdate met e_gen_remove, ${skipped} al klaar of leeg`);
await prisma.$disconnect();
