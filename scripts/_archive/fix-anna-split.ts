// Split anna folder:
//   - anna-bank: behoudt copilot-1, copilot-2, anna 1.png, anna 2.png, anna.png
//   - anna-hoekbank: krijgt anna hoek 1.png + anna hoek.png als nieuwe foto's
//     (vervangt placeholder hero.png / detail-1.png)
//
// Run:
//   npx tsx scripts/fix-anna-split.ts             # dry-run
//   npx tsx scripts/fix-anna-split.ts --apply     # echte upload + DB

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
const SRC_DIR = path.join(process.cwd(), "public/wetransfer_banken_2026-05-05_2016/banken/anna");
const HOEK_FILES = ["anna hoek 1.png", "anna hoek.png"];

async function uploadFile(localPath: string, publicId: string, folder: string) {
  const r = await cloudinary.uploader.upload(localPath, {
    public_id: publicId,
    folder,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
    quality: "auto:best",
    fetch_format: "auto",
  });
  return { url: r.secure_url, w: r.width, h: r.height };
}

async function main() {
  console.log(`\n═══ Anna split ═══`);
  console.log(`  Apply: ${APPLY ? "YES" : "no (dry-run)"}\n`);

  // anna-hoekbank: upload hoek-foto's
  const hoek = await prisma.product.findUnique({
    where: { slug: "anna-hoekbank" },
    select: { id: true, images: true, name: true },
  });
  if (!hoek) { console.error("anna-hoekbank niet gevonden"); process.exit(1); }

  const oldHoek = parseImages(hoek.images);
  console.log(`anna-hoekbank: nu ${oldHoek.length} foto's`);
  oldHoek.forEach((i, idx) => console.log(`  [${idx}] (huidig) ${i.url.split("/upload/")[1]?.split("/").slice(-2).join("/")}`));

  console.log(`\n→ Upload nieuwe hero+detail naar mokka/hoekbanken/anna-hoekbank/:`);
  for (const f of HOEK_FILES) console.log(`   - ${f}`);

  // anna-bank: verwijder photo-3 (anna hoek 1.png) en photo-4 (anna hoek.png)
  const bank = await prisma.product.findUnique({
    where: { slug: "anna-bank" },
    select: { id: true, images: true, name: true },
  });
  if (!bank) { console.error("anna-bank niet gevonden"); process.exit(1); }

  const allBank = parseImages(bank.images);
  // Hoek-foto's hebben in URL "/photo-3" of "/photo-4" voor anna-bank
  const keepBank = allBank.filter((i) => {
    const u = i.url;
    return !/anna-bank\/photo-3\b/.test(u) && !/anna-bank\/photo-4\b/.test(u);
  });
  console.log(`\nanna-bank: ${allBank.length} → ${keepBank.length} foto's`);
  console.log(`  Te verwijderen:`);
  allBank
    .filter((i) => /anna-bank\/(photo-3|photo-4)\b/.test(i.url))
    .forEach((i) => console.log(`    - ${i.url.split("/upload/")[1]?.split("/").slice(-2).join("/")}`));

  if (!APPLY) {
    console.log(`\n[DRY-RUN]`);
    return;
  }

  // ─── Upload hoek-foto's voor anna-hoekbank ───
  const cldFolder = "mokka/hoekbanken/anna-hoekbank";
  const newHoek: { url: string; w: number; h: number }[] = [];
  for (const [i, f] of HOEK_FILES.entries()) {
    const localPath = path.join(SRC_DIR, f);
    // Check file bestaat
    try { await fs.access(localPath); } catch { console.error(`  ✗ niet gevonden: ${localPath}`); continue; }
    const publicId = i === 0 ? "hero" : `detail-${i}`;
    const r = await uploadFile(localPath, publicId, cldFolder);
    newHoek.push(r);
    console.log(`  ✓ ${publicId}  (${r.w}×${r.h})`);
  }

  if (newHoek.length === 0) { console.error("Geen uploads gelukt"); process.exit(1); }

  // ─── Update anna-hoekbank ───
  await prisma.product.update({
    where: { id: hoek.id },
    data: { images: JSON.stringify(newHoek) },
  });
  console.log(`\n✓ anna-hoekbank.images = ${newHoek.length} foto's`);

  // ─── Update anna-bank (zonder hoek-foto's, hernumber photo-N) ───
  // Eerst de originele copilot-1, copilot-2, photo-1, photo-2, photo-5
  // → moeten worden copilot-1, copilot-2, photo-1, photo-2, photo-3
  // De Cloudinary URLs ZELF veranderen we niet (publicId blijft), maar de
  // images-array in DB blijft consistent.
  await prisma.product.update({
    where: { id: bank.id },
    data: { images: JSON.stringify(keepBank) },
  });
  console.log(`✓ anna-bank.images = ${keepBank.length} foto's (verwijderd: photo-3, photo-4)`);

  console.log(`\n✓ Klaar.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
