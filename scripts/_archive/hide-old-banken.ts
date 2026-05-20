/**
 * Verberg alle bestaande banken + hoekbanken (niet verwijderen — alleen hidden=true).
 * Gebruikt raw SQL omdat Prisma-client nog niet het nieuwe veld kent tot regenerate.
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

const affected = await prisma.$executeRaw`
  UPDATE "Product"
  SET hidden = true
  WHERE category IN ('banken', 'hoekbanken') AND hidden = false
`;
console.log(`${affected} banken/hoekbanken verborgen (hidden=true)`);

await prisma.$disconnect();
