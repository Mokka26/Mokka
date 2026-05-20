// Audit Cloudinary assets vs DB-referenties.
//
// Output:
//   - Totaal Cloudinary assets in mokka/* folder
//   - Aantal in gebruik (Product.images of DeletedImage)
//   - Aantal orphan (kandidaat voor destroy)
//   - Per orphan: publicId + size + format
//
// Run:
//   npx tsx scripts/audit-cloudinary-orphans.ts > cloudinary-audit.txt

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

type ResourceInfo = {
  public_id: string;
  bytes: number;
  format: string;
  folder?: string;
  created_at: string;
};

async function listAllResources(): Promise<ResourceInfo[]> {
  const out: ResourceInfo[] = [];
  let nextCursor: string | undefined;
  let page = 0;
  do {
    page++;
    process.stderr.write(`  Cloudinary page ${page}...\n`);
    const r = await cloudinary.api.resources({
      type: "upload",
      prefix: "mokka",
      max_results: 500,
      next_cursor: nextCursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const item of r.resources) {
      out.push({
        public_id: item.public_id,
        bytes: item.bytes,
        format: item.format,
        folder: item.folder,
        created_at: item.created_at,
      });
    }
    nextCursor = r.next_cursor;
  } while (nextCursor);
  return out;
}

async function collectInUseIds(): Promise<Set<string>> {
  const ids = new Set<string>();

  // 1. Alle product images (incl deleted products)
  const products = await prisma.product.findMany({ select: { images: true } });
  for (const p of products) {
    for (const img of parseImages(p.images)) {
      const pid = extractPublicId(img.url);
      if (pid) ids.add(pid);
    }
  }

  // 2. DeletedImage table entries (nog te purgen, maar wel reserved)
  const deletedImages = await prisma.deletedImage.findMany({ select: { publicId: true } });
  for (const di of deletedImages) ids.add(di.publicId);

  return ids;
}

async function main() {
  console.log("═══ Cloudinary orphan audit ═══\n");

  const [resources, inUse] = await Promise.all([listAllResources(), collectInUseIds()]);

  console.log(`Total Cloudinary assets in mokka/*: ${resources.length}`);
  console.log(`Total in-use publicIds (DB Product + DeletedImage): ${inUse.size}\n`);

  const orphans = resources.filter((r) => !inUse.has(r.public_id));
  const totalOrphanBytes = orphans.reduce((s, r) => s + r.bytes, 0);
  console.log(`ORPHANS: ${orphans.length} (${(totalOrphanBytes / 1024 / 1024).toFixed(1)} MB)\n`);

  // Groepeer orphans per folder (eerste 2 segmenten)
  const byFolder = new Map<string, { count: number; bytes: number; samples: string[] }>();
  for (const o of orphans) {
    const parts = o.public_id.split("/");
    const folder = parts.slice(0, 2).join("/") || "(root)";
    if (!byFolder.has(folder)) byFolder.set(folder, { count: 0, bytes: 0, samples: [] });
    const e = byFolder.get(folder)!;
    e.count++;
    e.bytes += o.bytes;
    if (e.samples.length < 3) e.samples.push(o.public_id);
  }

  console.log("─── Orphans per folder ───");
  console.log(`${"FOLDER".padEnd(45)} ${"COUNT".padStart(6)}  ${"SIZE".padStart(10)}`);
  const sorted = Array.from(byFolder.entries()).sort((a, b) => b[1].bytes - a[1].bytes);
  for (const [folder, info] of sorted) {
    console.log(`${folder.padEnd(45)} ${String(info.count).padStart(6)}  ${(info.bytes / 1024 / 1024).toFixed(2).padStart(7)} MB`);
    if (process.argv.includes("--verbose")) {
      for (const s of info.samples) console.log(`    · ${s}`);
    }
  }

  console.log(`\n─── Samenvatting ───`);
  console.log(`  Total assets:      ${resources.length}`);
  console.log(`  In gebruik:        ${resources.length - orphans.length}`);
  console.log(`  Orphan (te wissen): ${orphans.length}`);
  console.log(`  Te besparen:       ${(totalOrphanBytes / 1024 / 1024).toFixed(1)} MB`);

  // Schrijf orphan-lijst weg
  const fs = await import("node:fs/promises");
  await fs.writeFile(
    "cloudinary-orphans.json",
    JSON.stringify(orphans.map((o) => o.public_id), null, 2),
  );
  console.log(`\n✓ Orphan publicIds opgeslagen in cloudinary-orphans.json`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
