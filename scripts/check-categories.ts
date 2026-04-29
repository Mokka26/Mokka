import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

(async () => {
  const all = await prisma.product.findMany({
    select: { slug: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

  const hoekbanken = all.filter((p) => /hoekbank/i.test(p.name));
  const matrassen = all.filter((p) => /matras/i.test(p.name));

  console.log(`HOEKBANKEN (${hoekbanken.length}):`);
  for (const p of hoekbanken) console.log(`  ${p.category.padEnd(10)} - ${p.name}`);

  console.log(`\nMATRASSEN (${matrassen.length}):`);
  for (const p of matrassen) console.log(`  ${p.category.padEnd(10)} - ${p.name}`);

  console.log(`\nALLE CATEGORIEEN:`);
  const cats = new Map<string, number>();
  for (const p of all) cats.set(p.category, (cats.get(p.category) ?? 0) + 1);
  for (const [c, n] of Array.from(cats)) console.log(`  ${c}: ${n}`);

  await prisma.$disconnect();
})();
