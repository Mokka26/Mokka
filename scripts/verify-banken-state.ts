import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface Row { category: string; hidden: boolean; count: number }
const rows = await prisma.$queryRaw<Row[]>`
  SELECT category, hidden, COUNT(*)::int as count
  FROM "Product"
  WHERE category IN ('banken', 'hoekbanken')
  GROUP BY category, hidden
  ORDER BY category, hidden
`;
console.log("=== Banken state ===");
for (const r of rows) {
  console.log(`  ${r.category.padEnd(12)} hidden=${r.hidden}: ${r.count}`);
}

// Toon de nieuwe (zichtbare) banken
const visible = await prisma.$queryRaw<{ slug: string; name: string }[]>`
  SELECT slug, name FROM "Product"
  WHERE category IN ('banken','hoekbanken') AND hidden = false
  ORDER BY category, name
`;
console.log(`\n=== ${visible.length} zichtbare banken ===`);
for (const v of visible) console.log(`  ${v.slug.padEnd(40)} ${v.name}`);

await prisma.$disconnect();
