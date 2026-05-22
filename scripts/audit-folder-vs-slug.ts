// Voor elke Cloudinary-folder onder mokka/banken/ en mokka/hoekbanken/:
//   - Tel hoeveel foto's erin staan
//   - Tel hoeveel daarvan in DB worden gerefereerd (Product.images)
//   - Toon discrepantie (foto's op Cloudinary, NIET in DB)
//
// Vindt cases waar:
//   - Folder bestaat maar product is hernoemd
//   - Product heeft 4 foto's in DB maar 8 in folder
//   - Folder hoort bij product dat hard-deleted is (geen DeletedImage entry)

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

async function listMokka(): Promise<{ public_id: string; bytes: number }[]> {
  const out: { public_id: string; bytes: number }[] = [];
  let cursor: string | undefined;
  do {
    const r = await cloudinary.api.resources({
      type: "upload",
      prefix: "mokka",
      max_results: 500,
      next_cursor: cursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const item of r.resources) {
      out.push({ public_id: item.public_id, bytes: item.bytes ?? 0 });
    }
    cursor = r.next_cursor;
  } while (cursor);
  return out;
}

async function main() {
  console.log("\n═══ Folder vs DB-slug audit ═══\n");

  const assets = await listMokka();
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { slug: true, name: true, images: true, hidden: true },
  });
  const deletedImages = await prisma.deletedImage.findMany({ select: { url: true } });

  // DB-referenced publicIds
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

  // Groepeer assets per folder (= mokka/{categorie}/{product-slug})
  const folders = new Map<string, { all: typeof assets; inDb: number; notInDb: typeof assets }>();
  for (const a of assets) {
    const parts = a.public_id.split("/");
    if (parts.length < 4) continue; // niet diep genoeg
    const folder = parts.slice(0, 3).join("/"); // bv "mokka/banken/anna-bank"
    const entry = folders.get(folder) ?? { all: [], inDb: 0, notInDb: [] };
    entry.all.push(a);
    if (inDb.has(a.public_id)) entry.inDb++;
    else entry.notInDb.push(a);
    folders.set(folder, entry);
  }

  // Slug-set uit DB voor folder-match
  const dbSlugs = new Set(products.map((p) => p.slug));

  // Categoriseer folders
  type Cat = "no_db_product" | "partial" | "complete";
  const buckets: Record<Cat, { folder: string; total: number; notInDb: number; bytes: number; sample: string[] }[]> = {
    no_db_product: [],
    partial: [],
    complete: [],
  };

  for (const [folder, info] of folders.entries()) {
    const slug = folder.split("/")[2];
    const bytes = info.notInDb.reduce((s, r) => s + r.bytes, 0);
    const sample = info.notInDb.slice(0, 5).map((r) => r.public_id);

    const entry = { folder, total: info.all.length, notInDb: info.notInDb.length, bytes, sample };

    if (!dbSlugs.has(slug)) {
      buckets.no_db_product.push(entry);
    } else if (info.notInDb.length > 0) {
      buckets.partial.push(entry);
    } else {
      buckets.complete.push(entry);
    }
  }

  // Rapporteer
  console.log(`─── Folders zonder DB-product (slug bestaat niet meer) ───`);
  if (buckets.no_db_product.length === 0) {
    console.log("  (geen)");
  } else {
    buckets.no_db_product.sort((a, b) => b.bytes - a.bytes);
    for (const e of buckets.no_db_product) {
      console.log(`\n  ${e.folder}   ${e.total} foto's, ${(e.bytes / 1024 / 1024).toFixed(1)} MB`);
      for (const s of e.sample) console.log(`    ✗ ${s}`);
      if (e.notInDb.length > e.sample.length) {
        console.log(`    ... en ${e.notInDb.length - e.sample.length} meer`);
      }
    }
  }

  console.log(`\n─── Folders waar product bestaat maar EXTRA foto's op Cloudinary staan ───`);
  if (buckets.partial.length === 0) {
    console.log("  (geen)");
  } else {
    buckets.partial.sort((a, b) => b.bytes - a.bytes);
    let totalExtra = 0;
    let totalBytes = 0;
    for (const e of buckets.partial) {
      totalExtra += e.notInDb;
      totalBytes += e.bytes;
      console.log(`\n  ${e.folder}   ${e.total} totaal, ${e.notInDb} niet in DB, ${(e.bytes / 1024 / 1024).toFixed(1)} MB extra`);
      for (const s of e.sample) console.log(`    ✗ ${s}`);
      if (e.notInDb > e.sample.length) {
        console.log(`    ... en ${e.notInDb - e.sample.length} meer`);
      }
    }
    console.log(`\n  TOTAAL extra foto's in DB-bekende folders: ${totalExtra} (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
  }

  console.log(`\n─── Samenvatting ───`);
  console.log(`  Folders zonder DB-product:   ${buckets.no_db_product.length}`);
  console.log(`  Folders met extra foto's:    ${buckets.partial.length}`);
  console.log(`  Folders 1:1 met DB:          ${buckets.complete.length}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
