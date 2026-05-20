import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

// Slugs die door wetransfer-import zijn bijgewerkt maar nog hidden zijn
const slugs = [
  "anna-bank", "ares-bank", "bella-bank", "clara-bank",
  "cloud-bank", "coast-lux-bank", "finn-bank",
];

const affected = await prisma.$executeRaw`
  UPDATE "Product" SET hidden = false
  WHERE slug IN ('anna-bank','ares-bank','bella-bank','clara-bank','cloud-bank','coast-lux-bank','finn-bank')
    AND hidden = true
`;
console.log(`${affected} banken unhidden (nieuwe wetransfer fotos)`);
console.log(`(slugs gecheckt: ${slugs.join(", ")})`);
await prisma.$disconnect();
