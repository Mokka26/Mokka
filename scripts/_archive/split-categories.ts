/**
 * Verplaatst hoekbanken naar eigen categorie en maakt placeholder
 * producten voor matrassen.
 *
 * Gebruik: npx tsx scripts/split-categories.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

const PLACEHOLDER_IMG = "https://res.cloudinary.com/diaksxzey/image/upload/mokka/placeholders/coming-soon.jpg";

async function main() {
  // 1. Verplaats hoekbanken
  const hoekbanken = await prisma.product.findMany({
    where: { name: { contains: "Hoekbank", mode: "insensitive" }, category: "banken" },
    select: { id: true, name: true },
  });
  console.log(`Verplaats ${hoekbanken.length} hoekbanken naar 'hoekbanken'...`);
  for (const p of hoekbanken) {
    await prisma.product.update({ where: { id: p.id }, data: { category: "hoekbanken" } });
    console.log(`  ${p.name}`);
  }

  // 2. Matrassen placeholder
  const existing = await prisma.product.count({ where: { category: "matrassen" } });
  if (existing === 0) {
    console.log(`\nAanmaken matrassen placeholders...`);
    const placeholders = [
      {
        slug: "matras-product-1",
        name: "Matras Premium",
        description: "Binnenkort beschikbaar — premium pocketveer matras met hoge slaapcomfort.",
        price: 599,
        category: "matrassen",
        images: JSON.stringify([{ url: PLACEHOLDER_IMG, w: 1200, h: 1200 }]),
        featured: false,
        stock: 0,
      },
      {
        slug: "matras-product-2",
        name: "Matras Comfort",
        description: "Binnenkort beschikbaar — koudschuim matras voor optimale ondersteuning.",
        price: 449,
        category: "matrassen",
        images: JSON.stringify([{ url: PLACEHOLDER_IMG, w: 1200, h: 1200 }]),
        featured: false,
        stock: 0,
      },
    ];
    for (const p of placeholders) {
      await prisma.product.create({ data: p });
      console.log(`  ${p.name}`);
    }
  } else {
    console.log(`\n${existing} matrassen bestaan al — skip`);
  }

  console.log(`\nKlaar`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
