/**
 * Verwijdert dode (404) Cloudinary URLs uit Product.images.
 * Per product: HEAD-request elke URL, behoud alleen 200's.
 *
 * Gebruik:
 *   npx tsx scripts/remove-dead-images.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const prisma = new PrismaClient();

type ProductImage = { url: string; w?: number; h?: number };

function parseImages(raw: string): ProductImage[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((item): ProductImage[] => {
      if (typeof item === "string") return [{ url: item }];
      if (item && typeof item === "object" && typeof item.url === "string") {
        return [
          {
            url: item.url,
            w: typeof item.w === "number" ? item.w : undefined,
            h: typeof item.h === "number" ? item.h : undefined,
          },
        ];
      }
      return [];
    });
  } catch {
    return [];
  }
}

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
