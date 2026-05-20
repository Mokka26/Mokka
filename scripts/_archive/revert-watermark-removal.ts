/**
 * Revert: verwijder de e_gen_remove transformatie uit alle bank/hoekbank image URLs.
 * Originele Cloudinary assets blijven onveranderd; alleen de URL-prefix wordt teruggedraaid.
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface ImageEntry { url: string; w?: number; h?: number }

function stripGenRemove(url: string): string {
  // Verwijder e_gen_remove:prompt_(...) segment direct na /upload/
  return url.replace(/\/upload\/e_gen_remove:prompt_\([^)]*\)\//, "/upload/");
}

const products = await prisma.$queryRaw<Array<{ id: string; slug: string; images: string }>>`
  SELECT id, slug, images FROM "Product"
  WHERE category IN ('banken','hoekbanken')
`;

console.log(`Check ${products.length} banken/hoekbanken voor revert...\n`);

let reverted = 0;
for (const p of products) {
  let imgs: ImageEntry[] = [];
  try { imgs = JSON.parse(p.images) ?? []; } catch { continue; }
  if (imgs.length === 0) continue;

  const newImgs = imgs.map((i) => ({ ...i, url: stripGenRemove(i.url) }));
  const changed = newImgs.some((img, i) => img.url !== imgs[i].url);
  if (!changed) continue;

  await prisma.product.update({
    where: { id: p.id },
    data: { images: JSON.stringify(newImgs) },
  });
  console.log(`  ${p.slug.padEnd(35)} ${newImgs.length} foto(s) gerevert`);
  reverted++;
}

console.log(`\n${reverted} producten gerevert naar originele foto's`);
await prisma.$disconnect();
