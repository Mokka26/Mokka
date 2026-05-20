// Import ChatGPT-foto's die user heeft toegevoegd aan bank-folders.
// Werkt als Copilot-import: ChatGPT-foto's worden hero + scene foto's
// VOORAAN in de images array geplaatst.
//
// Run:
//   npx tsx scripts/import-chatgpt-photos.ts             # dry-run
//   npx tsx scripts/import-chatgpt-photos.ts --apply

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";
import { promises as fs } from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const APPLY = process.argv.includes("--apply");

// Mapping folder → bank slug
const FOLDER_MAP: Record<string, string> = {
  "finn": "finn-bank",
  "moana": "moana-bank",
  "mystic": "mystic-bank",
  "new bolton": "new-bolton-bank",
};

const SRC_BASE = path.join(process.cwd(), "public/wetransfer_banken_2026-05-05_2016/banken");

async function uploadFile(localPath: string, publicId: string, folder: string) {
  const r = await cloudinary.uploader.upload(localPath, {
    public_id: publicId, folder,
    resource_type: "image", overwrite: true, invalidate: true,
    quality: "auto:best", fetch_format: "auto",
  });
  return { url: r.secure_url, w: r.width, h: r.height };
}

async function main() {
  console.log(`\n═══ Import ChatGPT-foto's ═══`);
  console.log(`  Apply: ${APPLY ? "YES" : "no (dry-run)"}\n`);

  for (const [folderName, slug] of Object.entries(FOLDER_MAP)) {
    const folderPath = path.join(SRC_BASE, folderName);
    let files: string[];
    try {
      files = (await fs.readdir(folderPath)).filter((f) => /^ChatGPT/i.test(f) && /\.(png|jpg|jpeg)$/i.test(f)).sort();
    } catch { console.log(`  ✗ ${folderName}: folder niet gelezen`); continue; }

    if (files.length === 0) { console.log(`  · ${folderName}: geen ChatGPT-foto's`); continue; }

    const p = await prisma.product.findUnique({
      where: { slug },
      select: { id: true, name: true, category: true, images: true },
    });
    if (!p) { console.log(`  ✗ DB product niet gevonden: ${slug}`); continue; }

    const existing = parseImages(p.images);
    const cldFolder = `mokka/${p.category}/${slug}`;

    console.log(`\n▶ ${slug}  (cat=${p.category}, nu ${existing.length} foto's)`);
    for (const f of files) console.log(`   ${f}`);

    if (!APPLY) continue;

    const newImgs: { url: string; w: number; h: number }[] = [];
    for (const [i, f] of files.entries()) {
      const publicId = `chatgpt-${i + 1}`;
      try {
        const r = await uploadFile(path.join(folderPath, f), publicId, cldFolder);
        newImgs.push(r);
        console.log(`   ✓ ${publicId}  (${r.w}×${r.h})`);
      } catch (e) {
        console.error(`   ✗ ${publicId}: ${(e as Error).message}`);
      }
    }

    // Plaats ChatGPT vooraan + bestaande daarna
    const merged = [...newImgs, ...existing];
    await prisma.product.update({
      where: { id: p.id },
      data: { images: JSON.stringify(merged) },
    });
    console.log(`   → DB: ${newImgs.length} ChatGPT-foto's vooraan, totaal ${merged.length}`);
  }

  console.log(`\n✓ Klaar.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
