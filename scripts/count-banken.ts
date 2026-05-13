import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

const banken = await prisma.product.findMany({
  where: { category: "banken" },
  select: { slug: true, name: true, price: true },
  orderBy: { name: "asc" },
});
console.log(`Totaal banken in DB: ${banken.length}`);
for (const b of banken) console.log(`  ${b.slug.padEnd(30)} ${b.name}`);
await prisma.$disconnect();
