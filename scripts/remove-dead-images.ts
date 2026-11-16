/**
 * Verwijdert dode (404) Cloudinary URLs uit Product.images.
 * Per product: HEAD-request elke URL, behoud alleen 200's.
 *
 * Gebruik:
 *   npx tsx scripts/remove-dead-images.ts            # dry-run: alleen tonen
 *   npx tsx scripts/remove-dead-images.ts --apply    # dode URLs echt uit de DB halen
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { parseImages, type ProductImage } from "@/lib/imageHelpers";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

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

  console.log(`Scan ${products.length} producten...${APPLY ? "" : " (dry-run, geen DB-write; gebruik --apply)"}\n`);
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

    if (dropped === 0) continue;
    if (!APPLY) {
      console.log(`  ${p.slug}: ${dropped} dode foto's zouden weggehaald worden (${checked.length} over)`);
      continue;
    }
    await prisma.product.update({
      where: { id: p.id },
      data: { images: JSON.stringify(checked) },
    });
    console.log(`  ${p.slug}: ${dropped} dode foto's weggehaald (${checked.length} over)`);
  }

  console.log(APPLY ? `\n${removed} dode URLs verwijderd` : `\n${removed} dode URLs gevonden; niets gewijzigd (gebruik --apply)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
