// Volledige Cloudinary-account audit — niet beperkt tot mokka/* prefix.
// Toont alle resources verdeeld over top-level folders + per resource_type.
// Identificeert wat NIET in DB staat (echte orphans buiten mokka/*).
//
// Run:
//   npx tsx scripts/audit-cloudinary-full.ts > cloudinary-full.txt

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

type Resource = {
  public_id: string;
  bytes: number;
  format: string;
  resource_type: string;
  created_at: string;
  folder?: string;
};

async function listAll(resourceType: "image" | "video" | "raw"): Promise<Resource[]> {
  const out: Resource[] = [];
  let nextCursor: string | undefined;
  let page = 0;
  do {
    page++;
    process.stderr.write(`  ${resourceType} page ${page}...\n`);
    const r = await cloudinary.api.resources({
      resource_type: resourceType,
      type: "upload",
      max_results: 500,
      next_cursor: nextCursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const item of r.resources) {
      out.push({
        public_id: item.public_id,
        bytes: item.bytes ?? 0,
        format: item.format ?? "",
        resource_type: resourceType,
        created_at: item.created_at,
        folder: item.folder,
      });
    }
    nextCursor = r.next_cursor;
  } while (nextCursor);
  return out;
}

async function main() {
  console.log("\n═══ Volledige Cloudinary-account audit ═══\n");

  // 1. Alle resources, niet alleen images
  const [images, videos, raws] = await Promise.all([
    listAll("image"),
    listAll("video").catch(() => [] as Resource[]),
    listAll("raw").catch(() => [] as Resource[]),
  ]);

  const all = [...images, ...videos, ...raws];
  const totalBytes = all.reduce((s, r) => s + r.bytes, 0);
  console.log(`\nTotaal resources: ${all.length} (${(totalBytes / 1024 / 1024).toFixed(0)} MB)`);
  console.log(`  Images: ${images.length}`);
  console.log(`  Videos: ${videos.length}`);
  console.log(`  Raw:    ${raws.length}`);

  // 2. Per top-level folder
  console.log("\n─── Per top-level folder ───");
  const byFolder = new Map<string, { count: number; bytes: number }>();
  for (const r of all) {
    const folder = r.public_id.includes("/") ? r.public_id.split("/")[0] : "(root)";
    const cur = byFolder.get(folder) ?? { count: 0, bytes: 0 };
    cur.count++;
    cur.bytes += r.bytes;
    byFolder.set(folder, cur);
  }
  const folderArr = Array.from(byFolder.entries()).sort((a, b) => b[1].bytes - a[1].bytes);
  for (const [folder, stats] of folderArr) {
    console.log(`  ${folder.padEnd(30)} ${stats.count.toString().padStart(5)} files  ${(stats.bytes / 1024 / 1024).toFixed(1).padStart(8)} MB`);
  }

  // 3. DB-references — wat IS in gebruik
  console.log("\n─── DB-cross-check ───");
  const products = await prisma.product.findMany({ select: { images: true } });
  const deletedImages = await prisma.deletedImage.findMany({ select: { url: true } });

  const inUse = new Set<string>();
  for (const p of products) {
    for (const img of parseImages(p.images)) {
      const id = extractPublicId(img.url);
      if (id) inUse.add(id);
    }
  }
  for (const d of deletedImages) {
    const id = extractPublicId(d.url);
    if (id) inUse.add(id);
  }

  console.log(`  Publicid's in DB:  ${inUse.size}`);

  // 4. Orphans per folder
  console.log("\n─── Orphans per folder (niet in DB) ───");
  const orphansByFolder = new Map<string, { count: number; bytes: number; samples: string[] }>();
  let totalOrphans = 0;
  let totalOrphanBytes = 0;
  for (const r of all) {
    if (inUse.has(r.public_id)) continue;
    totalOrphans++;
    totalOrphanBytes += r.bytes;
    const folder = r.public_id.includes("/") ? r.public_id.split("/")[0] : "(root)";
    const cur = orphansByFolder.get(folder) ?? { count: 0, bytes: 0, samples: [] };
    cur.count++;
    cur.bytes += r.bytes;
    if (cur.samples.length < 5) cur.samples.push(r.public_id);
    orphansByFolder.set(folder, cur);
  }

  const orphArr = Array.from(orphansByFolder.entries()).sort((a, b) => b[1].bytes - a[1].bytes);
  if (orphArr.length === 0) {
    console.log("  (geen orphans gevonden)");
  } else {
    for (const [folder, stats] of orphArr) {
      console.log(`\n  ${folder}   ${stats.count} files, ${(stats.bytes / 1024 / 1024).toFixed(1)} MB`);
      for (const s of stats.samples) {
        console.log(`    ✗ ${s}`);
      }
      if (stats.count > stats.samples.length) {
        console.log(`    ... en ${stats.count - stats.samples.length} meer`);
      }
    }
  }

  console.log(`\n─── Samenvatting ───`);
  console.log(`  Totaal resources:  ${all.length}`);
  console.log(`  In gebruik (DB):   ${all.length - totalOrphans}`);
  console.log(`  Orphan:            ${totalOrphans}  (${(totalOrphanBytes / 1024 / 1024).toFixed(1)} MB)`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
