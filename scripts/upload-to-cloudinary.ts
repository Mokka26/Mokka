/**
 * Upload alle productfoto's naar Cloudinary
 *
 * Gebruik:
 *   npx tsx scripts/upload-to-cloudinary.ts
 */

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();
const BASE_DIR = path.join(process.cwd(), "temp_extract");

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function uploadProductImages() {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("❌ CLOUDINARY_API_KEY en CLOUDINARY_API_SECRET ontbreken");
    process.exit(1);
  }

  if (!fs.existsSync(BASE_DIR)) {
    console.error(`❌ Map niet gevonden: ${BASE_DIR}`);
    process.exit(1);
  }

  const dirs = fs.readdirSync(BASE_DIR).filter((d) => {
    const full = path.join(BASE_DIR, d);
    return fs.statSync(full).isDirectory();
  });

  console.log(`📂 Gevonden: ${dirs.length} productmappen\n`);

  let totalUploaded = 0;
  const allUploads: Record<string, { slug: string; name: string; urls: string[] }> = {};

  for (const dirName of dirs) {
    const slug = slugify(dirName);
    const dir = path.join(BASE_DIR, dirName);
    const files = fs.readdirSync(dir)
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort();

    if (files.length === 0) continue;

    console.log(`📦 ${dirName} → ${slug} (${files.length} foto's)`);
    const urls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(dir, file);
      const publicId = `mokka/banken/${slug}/${String(i + 1).padStart(2, "0")}`;

      try {
        const result = await cloudinary.uploader.upload(filePath, {
          public_id: publicId,
          overwrite: true,
          resource_type: "image",
          quality: "auto:best",
          fetch_format: "auto",
        });
        urls.push(result.secure_url);
        totalUploaded++;
        process.stdout.write(".");
      } catch (err: any) {
        console.error(`\n❌ Fout bij ${file}:`, err.message);
      }
    }

    allUploads[slug] = { slug, name: dirName, urls };
    console.log(` ✓ ${urls.length} geüpload`);
  }

  // Update database: match op slug
  console.log("\n📝 Database bijwerken...");
  for (const [slug, data] of Object.entries(allUploads)) {
    const product = await prisma.product.findUnique({ where: { slug } });
    if (product) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images: JSON.stringify(data.urls.slice(0, 8)) },
      });
      console.log(`  ✓ ${slug} (${data.urls.length} URLs)`);
    } else {
      console.log(`  ⚠ slug niet in DB: ${slug}`);
    }
  }

  console.log(`\n✅ ${totalUploaded} foto's geüpload naar Cloudinary`);
  console.log(`✅ Database bijgewerkt`);
  await prisma.$disconnect();
}

uploadProductImages().catch((e) => {
  console.error(e);
  process.exit(1);
});
