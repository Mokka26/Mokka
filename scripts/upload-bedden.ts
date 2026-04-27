/**
 * Upload bedden-foto's naar Cloudinary onder mokka/bedden/{slug}/
 *
 * Gebruik:
 *   npx tsx scripts/upload-bedden.ts
 *
 * Verwacht: C:/temp/extract-test/ met submappen (bed-modellen), elk met JPGs.
 * Output: scripts/bedden-uploads.json — map van slug → {name, urls[]}
 */

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { config } from "dotenv";

config({ path: ".env.local" });

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const BASE_DIR = "C:/temp/extract-test";
const OUTPUT_FILE = path.join(process.cwd(), "scripts", "bedden-uploads.json");
const MAX_PHOTOS_PER_BED = 5;
const RESIZE_WIDTH = 2400; // max breedte na resize
const RESIZE_QUALITY = 88; // JPEG quality

// Folders die noise zijn (subfolders, duplicates, irrelevant)
const SKIP_FOLDER_NAMES = new Set([
  "__MACOSX",
  "4 mevsim",            // Turkse "4 seizoenen", subfolder van capadocia
  "NATURA BED SET",      // capadocia subfolder
  "tekstilli foto",      // Turkse "textiel foto", subfolder
  "BOHAMELA",            // duplicate van BOHEMELLA
  "bohemela",            // duplicate van BOHEMELLA
  "ELENA GRİ - SADECE BAZA",      // ELENA TIF only
  "ELENA KREM - SADECE BAZA",     // ELENA TIF only
]);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/i̇/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Skip irrelevante mappen
function shouldSkipFolder(name: string): boolean {
  return (
    SKIP_FOLDER_NAMES.has(name) ||
    name.endsWith("_files") ||
    name.startsWith(".")
  );
}

// Resize via sharp + upload buffer naar Cloudinary
async function resizeAndUpload(filePath: string, publicId: string): Promise<{ secure_url: string }> {
  const buffer = await sharp(filePath)
    .rotate() // EXIF orientation
    .resize({ width: RESIZE_WIDTH, withoutEnlargement: true, fit: "inside" })
    .jpeg({ quality: RESIZE_QUALITY, mozjpeg: true })
    .toBuffer();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      },
      (err, result) => {
        if (err || !result) reject(err);
        else resolve(result as { secure_url: string });
      },
    );
    stream.end(buffer);
  });
}

// Vind alle JPGs recursief, gegroepeerd op direct-parent map
function collectJpgsByFolder(rootDir: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (shouldSkipFolder(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(jpg|jpeg)$/i.test(e.name)) {
        try {
          const sz = fs.statSync(full).size;
          if (sz < 100_000 || sz > 40_000_000) continue;
        } catch {
          continue;
        }
        const parent = path.basename(path.dirname(full));
        if (shouldSkipFolder(parent)) continue;
        const arr = groups.get(parent) ?? [];
        arr.push(full);
        groups.set(parent, arr);
      }
    }
  }

  walk(rootDir);
  return groups;
}

async function main() {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("Cloudinary credentials ontbreken in .env.local");
    process.exit(1);
  }
  if (!fs.existsSync(BASE_DIR)) {
    console.error(`Bron-map ontbreekt: ${BASE_DIR}`);
    process.exit(1);
  }

  console.log(`Scan ${BASE_DIR}...`);
  const groups = collectJpgsByFolder(BASE_DIR);
  const folders = Array.from(groups.entries())
    .filter(([, files]) => files.length >= 2)
    .sort((a, b) => a[0].localeCompare(b[0]));

  console.log(`Gevonden: ${folders.length} mappen met >=2 JPGs\n`);
  for (const [name, files] of folders) {
    console.log(`  ${name}: ${files.length} JPGs`);
  }
  console.log("");

  const result: Record<string, { name: string; urls: string[] }> = {};
  let totalUploads = 0;

  for (const [folderName, files] of folders) {
    const slug = slugify(folderName);
    if (!slug) continue;

    // Sorteer alfabetisch + neem eerste N
    const selected = files.sort().slice(0, MAX_PHOTOS_PER_BED);

    console.log(`\n${folderName} → ${slug} (${selected.length}/${files.length} foto's)`);
    const urls: string[] = [];

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const publicId = `mokka/bedden/${slug}/${String(i + 1).padStart(2, "0")}`;
      try {
        const r = await resizeAndUpload(file, publicId);
        urls.push(r.secure_url);
        totalUploads++;
        process.stdout.write(".");
      } catch (err: any) {
        console.error(`\n  fout bij ${path.basename(file)}: ${err.message}`);
      }
    }
    result[slug] = { name: folderName, urls };
    console.log(` ${urls.length} klaar`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\n${totalUploads} foto's geüpload`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
