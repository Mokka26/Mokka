/**
 * Unhide alle banken/hoekbanken die recent zijn bijgewerkt (wetransfer imports).
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

// Update alles dat in de afgelopen 60 min is bijgewerkt
const affected = await prisma.$executeRaw`
  UPDATE "Product"
  SET hidden = false
  WHERE category IN ('banken', 'hoekbanken')
    AND hidden = true
    AND "updatedAt" > NOW() - INTERVAL '60 minutes'
`;
console.log(`${affected} banken/hoekbanken unhidden (recent geupdate)`);

// Toon eindstand
interface Row { category: string; hidden: boolean; count: number }
const rows = await prisma.$queryRaw<Row[]>`
  SELECT category, hidden, COUNT(*)::int as count
  FROM "Product"
  WHERE category IN ('banken','hoekbanken')
  GROUP BY category, hidden
  ORDER BY category, hidden
`;
console.log("\n=== Eindstand ===");
for (const r of rows) console.log(`  ${r.category.padEnd(12)} hidden=${r.hidden}: ${r.count}`);

await prisma.$disconnect();
