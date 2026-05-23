// Vind bit-identieke duplicaten op Cloudinary via ETag (= MD5 hash content).
// Toont groepen van >1 asset met identieke ETag.
//
// Run:
//   npx tsx scripts/find-duplicate-photos.ts

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

type Asset = { public_id: string; etag: string; bytes: number; width?: number; height?: number };

async function listAll(): Promise<Asset[]> {
  const out: Asset[] = [];
  let cursor: string | undefined;
  let page = 0;
  do {
    page++;
    process.stderr.write(`  page ${page}...\n`);
    const r = await cloudinary.api.resources({
      type: "upload",
      prefix: "mokka",
      max_results: 500,
      next_cursor: cursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const item of r.resources) {
      out.push({
        public_id: item.public_id,
        etag: item.etag ?? "",
        bytes: item.bytes ?? 0,
        width: item.width,
        height: item.height,
      });
    }
    cursor = r.next_cursor;
  } while (cursor);
  return out;
}

async function main() {
  console.log("\n═══ Vind bit-identieke duplicaten via ETag ═══\n");

  const assets = await listAll();
  console.log(`Geanalyseerd: ${assets.length} assets\n`);

  // Groepeer op etag
  const byEtag = new Map<string, Asset[]>();
  for (const a of assets) {
    if (!a.etag) continue;
    const arr = byEtag.get(a.etag) ?? [];
    arr.push(a);
    byEtag.set(a.etag, arr);
  }

  const dupes = Array.from(byEtag.entries()).filter(([, arr]) => arr.length > 1);
  console.log(`Duplicate groups: ${dupes.length}`);
  console.log(`Extra assets (te besparen indien gededupliceerd): ${dupes.reduce((s, [, arr]) => s + arr.length - 1, 0)}`);
  const wasteBytes = dupes.reduce((s, [, arr]) => s + arr.slice(1).reduce((b, a) => b + a.bytes, 0), 0);
  console.log(`Verspilde storage: ${(wasteBytes / 1024 / 1024).toFixed(1)} MB\n`);

  if (dupes.length === 0) {
    console.log("✓ Geen duplicaten gevonden.");
    process.exit(0);
  }

  // DB-info voor context
  const products = await prisma.product.findMany({
    select: { slug: true, images: true, hidden: true, deletedAt: true },
  });
  const productByPid = new Map<string, { slug: string; hidden: boolean; deleted: boolean }>();
  for (const p of products) {
    for (const img of parseImages(p.images)) {
      const pid = extractPublicId(img.url);
      if (pid) productByPid.set(pid, { slug: p.slug, hidden: p.hidden, deleted: !!p.deletedAt });
    }
  }

  // Sorteer groepen op grootte (meeste duplicaten + grootste bytes eerst)
  dupes.sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return b[1][0].bytes - a[1][0].bytes;
  });

  // Print groepen
  console.log("─── Duplicate groepen (top 30) ───");
  for (const [etag, arr] of dupes.slice(0, 30)) {
    const sizeKB = (arr[0].bytes / 1024).toFixed(0);
    const dim = arr[0].width && arr[0].height ? `${arr[0].width}×${arr[0].height}` : "?";
    console.log(`\n  ${arr.length}× ${sizeKB}KB ${dim}  etag=${etag.slice(0, 8)}...`);
    for (const a of arr) {
      const dbInfo = productByPid.get(a.public_id);
      const status = !dbInfo ? "[NOT-IN-DB]" : dbInfo.deleted ? "[DELETED]" : dbInfo.hidden ? "[HIDDEN]" : "[ZICHTBAAR]";
      console.log(`    ${status.padEnd(12)} ${a.public_id}`);
    }
  }
  if (dupes.length > 30) {
    console.log(`\n  ... en ${dupes.length - 30} meer duplicate groepen`);
  }

  // Per-product breakdown: welke producten hebben de meeste interne duplicaten?
  const dupesPerProduct = new Map<string, number>();
  for (const [, arr] of dupes) {
    const slugs = new Set<string>();
    for (const a of arr) {
      const slug = a.public_id.split("/")[2];
      slugs.add(slug);
    }
    for (const slug of slugs) {
      dupesPerProduct.set(slug, (dupesPerProduct.get(slug) ?? 0) + arr.length - 1);
    }
  }
  const topProducts = Array.from(dupesPerProduct.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`\n─── Top 15 producten met duplicaten ───`);
  for (const [slug, count] of topProducts) {
    console.log(`  ${count.toString().padStart(3)} dupes  ${slug}`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
