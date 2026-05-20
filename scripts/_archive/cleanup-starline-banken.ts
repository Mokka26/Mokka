/**
 * Verwijder de 3 test-banken (Tobi, Sanchez, Memory) uit DB + Cloudinary.
 *
 * Gebruik: npx tsx scripts/cleanup-starline-banken.ts
 */

import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";

config({ path: ".env.local" });

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();

const SLUGS = ["tobi-bank", "sanchez-bank", "memory-bank"];

async function main() {
  for (const slug of SLUGS) {
    console.log(`\n[${slug}]`);

    // Cloudinary: delete hero + crops + raw
    const publicIds = [
      `mokka/banken/${slug}/hero`,
      `mokka/banken/${slug}/detail-1`,
      `mokka/banken/${slug}/detail-2`,
      `mokka/banken/${slug}/detail-3`,
      `mokka/_raw/starline/${slug}`,
    ];
    for (const pid of publicIds) {
      try {
        const r = await cloudinary.uploader.destroy(pid, { resource_type: "image" });
        console.log(`  ${pid}: ${r.result}`);
      } catch (e) {
        console.log(`  ${pid}: skip (${(e as Error).message})`);
      }
    }

    // DB: delete product
    try {
      const deleted = await prisma.product.delete({ where: { slug } });
      console.log(`  DB: removed product ${deleted.id}`);
    } catch (e) {
      console.log(`  DB: skip (${(e as Error).message})`);
    }
  }

  console.log(`\nKlaar`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
