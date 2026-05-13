import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

const all = await prisma.product.findMany({
  where: { NOT: { colorGroup: null } },
  select: { colorGroup: true },
});
const counts = new Map<string, number>();
for (const x of all) {
  if (x.colorGroup) counts.set(x.colorGroup, (counts.get(x.colorGroup) ?? 0) + 1);
}
const singletons = Array.from(counts.entries())
  .filter(([, n]) => n === 1)
  .map(([g]) => g);

console.log(`${singletons.length} eenling-groups gevonden`);
const r = await prisma.product.updateMany({
  where: { colorGroup: { in: singletons } },
  data: { colorGroup: null, colorName: null, colorHex: null },
});
console.log(`${r.count} producten ungrouped`);
await prisma.$disconnect();
