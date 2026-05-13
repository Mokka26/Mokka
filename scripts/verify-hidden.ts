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
for (const r of rows) console.log(`${r.category} hidden=${r.hidden}: ${r.count}`);
await prisma.$disconnect();
