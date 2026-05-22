/**
 * Verwijdert dode (404) Cloudinary URLs uit Product.images.
 * Per product: HEAD-request elke URL, behoud alleen 200's.
 *
 * Gebruik:
 *   npx tsx scripts/remove-dead-images.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { parseImages } from "@/lib/imageHelpers";

config({ path: ".env.local" });

const prisma = new PrismaClient();

async function isAlive(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, images: true },
  });

  console.log(`Scan ${products.length} producten...\n`);
  let removed = 0;

  for (const p of products) {
    const imgs = parseImages(p.images);
    if (imgs.length === 0) continue;

    const checked: ProductImage[] = [];
    let dropped = 0;
    for (const img of imgs) {
      if (await isAlive(img.url)) {
        checked.push(img);
      } else {
        dropped++;
        removed++;
      }
    }

    if (dropped > 0) {
      await prisma.product.update({
        where: { id: p.id },
        data: { images: JSON.stringify(checked) },
      });
      console.log(`  ${p.slug}: ${dropped} dode foto's weggehaald (${checked.length} over)`);
    }
  }

  console.log(`\n${removed} dode URLs verwijderd`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
