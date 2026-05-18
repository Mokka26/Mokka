// Import handgemaakte foto's uit photos-todo/<slug>/{studio,lifestyle}/
// naar Cloudinary + update DB.
//
// Gebruik wanneer je de foto's al perfect hebt gemaakt en niet meer wilt
// transformeren via Cloudinary AI.
//
// Verwacht structuur:
//   photos-todo/<slug>/
//     studio/     studio-1.jpg, studio-2.jpg, ...  (eerste = hero)
//     lifestyle/  lifestyle-1.jpg, ...
//
// Volgorde in DB:
//   [0] studio-1 (hero)
//   [1] lifestyle-1
//   [2] studio-2
//   ... rest van studio's, dan rest van lifestyle's
//
// Run:
//   npx tsx scripts/import-manual-photos.ts <slug>
//
// Flags:
//   --dry-run         alleen rapport
//   --folder=<name>   Cloudinary folder (default: mokka/hoekbanken/<slug>-final)

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");
const folderOverride = args.find((a) => a.startsWith("--folder="))?.split("=")[1];

if (!slug) {
  console.error("Usage: tsx scripts/import-manual-photos.ts <slug> [--dry-run] [--folder=...]");
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const ROOT = process.cwd();
const todoDir = path.join(ROOT, "photos-todo", slug);
const studioDir = path.join(todoDir, "studio");
const lifestyleDir = path.join(todoDir, "lifestyle");
const cldFolder = folderOverride ?? `mokka/hoekbanken/${slug}-final`;

async function listPhotos(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir))
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
        const nb = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
        return na - nb;
      });
  } catch { return []; }
}

async function upload(localPath: string, publicId: string): Promise<string> {
  const result = await cloudinary.uploader.upload(localPath, {
    public_id: publicId,
    folder: cldFolder,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
  });
  return result.secure_url;
}

async function main() {
  console.log(`\n═══ Import handgemaakte foto's: ${slug} ═══`);
  console.log(`  Cloudinary folder: ${cldFolder}`);
  console.log(`  Dry-run:           ${DRY_RUN}\n`);

  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) { console.error(`Product niet gevonden: ${slug}`); process.exit(1); }

  const studios = await listPhotos(studioDir);
  const lifestyles = await listPhotos(lifestyleDir);

  console.log(`─── Bestanden ────────────────────────────────`);
  console.log(`  studio/:    ${studios.length}  ${studios.join(", ") || "(leeg)"}`);
  console.log(`  lifestyle/: ${lifestyles.length}  ${lifestyles.join(", ") || "(leeg)"}`);

  if (studios.length === 0 && lifestyles.length === 0) {
    console.error(`\nGeen foto's gevonden. Drop in:`);
    console.error(`  ${studioDir}`);
    console.error(`  ${lifestyleDir}`);
    process.exit(1);
  }

  // Plan: [hero, lifestyle-1, studio-2..N, lifestyle-2..N]
  const plan: { localPath: string; publicId: string; type: string }[] = [];
  if (studios[0]) plan.push({
    localPath: path.join(studioDir, studios[0]),
    publicId: "studio-1",
    type: "studio (hero)",
  });
  lifestyles.forEach((lf, i) => plan.push({
    localPath: path.join(lifestyleDir, lf),
    publicId: `lifestyle-${i + 1}`,
    type: "lifestyle",
  }));
  studios.slice(1).forEach((sf, i) => plan.push({
    localPath: path.join(studioDir, sf),
    publicId: `studio-${i + 2}`,
    type: "studio",
  }));

  console.log(`\n─── Upload plan ───────────────────────────────`);
  plan.forEach((p, i) =>
    console.log(`  [${i}] ${p.type.padEnd(15)} ${path.basename(p.localPath)}  →  ${cldFolder}/${p.publicId}`)
  );

  if (DRY_RUN) { console.log("\n[DRY-RUN] Geen upload + geen DB."); return; }

  console.log(`\n─── Uploaden ─────────────────────────────────`);
  const urls: string[] = [];
  for (const [i, p] of plan.entries()) {
    try {
      const url = await upload(p.localPath, p.publicId);
      console.log(`  ✓  [${i}] ${url.split("/upload/")[1]}`);
      urls.push(url);
    } catch (e) {
      console.error(`  ✗  [${i}] ${p.publicId}: ${(e as Error).message}`);
    }
  }

  if (urls.length === 0) { console.error(`\nGeen succesvolle uploads.`); process.exit(1); }

  await prisma.product.update({
    where: { slug },
    data: { images: JSON.stringify(urls) },
  });
  console.log(`\n✓ DB bijgewerkt: ${slug} → ${urls.length} foto's.`);
  console.log(`✓ Bekijk: http://localhost:3000/products/${slug}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
