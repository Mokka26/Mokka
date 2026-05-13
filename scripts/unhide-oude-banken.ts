/**
 * Unhide alleen de oude (pre-PDF) banken — die hebben "bankstel" in hun slug.
 * PDF-banken (Tobi, Anna, Mystic etc. allemaal "-bank" zonder "bankstel") blijven hidden.
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

// Eerst zien wat er hidden is met "bankstel" in slug (oude banken)
const oudeHidden = await prisma.$queryRaw<Array<{ slug: string; name: string }>>`
  SELECT slug, name FROM "Product"
  WHERE category IN ('banken','hoekbanken')
    AND hidden = true
    AND slug LIKE '%bankstel%'
  ORDER BY slug
`;

console.log(`${oudeHidden.length} oude banken (met 'bankstel' in slug) momenteel hidden:`);
for (const p of oudeHidden) console.log(`  ${p.slug.padEnd(35)} ${p.name}`);

const affected = await prisma.$executeRaw`
  UPDATE "Product" SET hidden = false
  WHERE category IN ('banken','hoekbanken')
    AND hidden = true
    AND slug LIKE '%bankstel%'
`;

console.log(`\n${affected} oude banken unhidden`);

// Eindstand
interface Row { category: string; hidden: boolean; count: number }
const rows = await prisma.$queryRaw<Row[]>`
  SELECT category, hidden, COUNT(*)::int as count
  FROM "Product"
  WHERE category IN ('banken','hoekbanken')
  GROUP BY category, hidden ORDER BY category, hidden
`;
console.log("\n=== Eindstand ===");
for (const r of rows) console.log(`  ${r.category.padEnd(12)} hidden=${r.hidden}: ${r.count}`);

await prisma.$disconnect();
