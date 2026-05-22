// Destroy Cloudinary orphans BUITEN de mokka/* folder (samples/ + root).
// Veiliger dan destroy-all want we whitelisten alleen de bekende junk:
//   - alles in samples/ (Cloudinary defaults)
//   - root-level files (geen folder-prefix)
//
// Cross-checkt elk public_id tegen DB voor we destroyen.
//
// Run:
//   npx tsx scripts/destroy-non-mokka-orphans.ts          # dry-run
//   npx tsx scripts/destroy-non-mokka-orphans.ts --apply  # destroy

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";
import { extractPublicId } from "@/lib/cloudinary-helpers";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const APPLY = process.argv.includes("--apply");

async function listImages(): Promise<{ public_id: string; bytes: number }[]> {
  const out: { public_id: string; bytes: number }[] = [];
  let nextCursor: string | undefined;
  do {
    const r = await cloudinary.api.resources({
      resource_type: "image",
      type: "upload",
      max_results: 500,
      next_cursor: nextCursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const item of r.resources) {
      out.push({ public_id: item.public_id, bytes: item.bytes ?? 0 });
    }
    nextCursor = r.next_cursor;
  } while (nextCursor);
  return out;
}

async function main() {
  console.log("\n═══ Destroy non-mokka orphans ═══");
  console.log(APPLY ? "MODE: APPLY (echte destroy)\n" : "MODE: dry-run\n");

  const all = await listImages();
  console.log(`Totaal images: ${all.length}`);

  // Whitelist scope: alleen samples/ + root (geen folder-prefix), NOOIT mokka/
  const candidates = all.filter((r) => {
    if (r.public_id.startsWith("mokka/")) return false;
    return true;
  });
  console.log(`Buiten mokka/: ${candidates.length}`);

  // Safety: cross-check tegen DB (overbodig want mokka/ uitgesloten, maar net-safe)
  const products = await prisma.product.findMany({ select: { images: true } });
  const deletedImages = await prisma.deletedImage.findMany({ select: { url: true } });
  const inDb = new Set<string>();
  for (const p of products) {
    for (const img of parseImages(p.images)) {
      const id = extractPublicId(img.url);
      if (id) inDb.add(id);
    }
  }
  for (const d of deletedImages) {
    const id = extractPublicId(d.url);
    if (id) inDb.add(id);
  }

  const protected_ = candidates.filter((c) => inDb.has(c.public_id));
  if (protected_.length > 0) {
    console.log("\n⚠ DB-referentie gevonden buiten mokka/ (skip):");
    for (const p of protected_) console.log(`  - ${p.public_id}`);
  }

  const toDestroy = candidates.filter((c) => !inDb.has(c.public_id));
  const totalBytes = toDestroy.reduce((s, r) => s + r.bytes, 0);

  console.log(`\nTe destroyen: ${toDestroy.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB\n`);
  for (const r of toDestroy) {
    console.log(`  ${r.public_id.padEnd(45)} ${(r.bytes / 1024).toFixed(0).padStart(6)} KB`);
  }

  if (!APPLY) {
    console.log("\nDry-run — geen mutaties. Run met --apply om uit te voeren.");
    process.exit(0);
  }

  console.log("\nDestroying...");
  let ok = 0;
  let fail = 0;
  for (const r of toDestroy) {
    try {
      const result = await cloudinary.uploader.destroy(r.public_id, { invalidate: true });
      if (result.result === "ok" || result.result === "not found") {
        console.log(`  ✓ ${r.public_id}`);
        ok++;
      } else {
        console.log(`  ✗ ${r.public_id}: ${result.result}`);
        fail++;
      }
    } catch (err) {
      console.log(`  ✗ ${r.public_id}: ${err instanceof Error ? err.message : err}`);
      fail++;
    }
    // Korte pauze om Cloudinary rate-limit te respecteren
    await new Promise((res) => setTimeout(res, 50));
  }

  console.log(`\n✓ ${ok}/${toDestroy.length} destroyed. ${fail} failed.`);
  console.log(`Geschatte besparing: ${(totalBytes / 1024 / 1024).toFixed(1)} MB.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
