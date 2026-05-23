// Per-categorie performance audit: products, image-counts, byte-payload op
// listing-page, oversized images, hidden cleanup kandidaten.
//
// Run: npx tsx scripts/audit-category-performance.ts

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

const OVERSIZED_BYTES = 500 * 1024; // 500KB+
const MAX_VISIBLE_PER_LISTING = 24; // matched pagination PAGE_SIZE

type AssetMeta = { bytes: number; width?: number; height?: number };

async function loadCloudinaryMeta(): Promise<Map<string, AssetMeta>> {
  const m = new Map<string, AssetMeta>();
  let cursor: string | undefined;
  do {
    const r = await cloudinary.api.resources({
      type: "upload",
      prefix: "mokka",
      max_results: 500,
      next_cursor: cursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const item of r.resources) {
      m.set(item.public_id, { bytes: item.bytes ?? 0, width: item.width, height: item.height });
    }
    cursor = r.next_cursor;
  } while (cursor);
  return m;
}

async function main() {
  console.log("\n═══ Per-categorie performance audit ═══\n");

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      slug: true,
      name: true,
      category: true,
      hidden: true,
      images: true,
      stock: true,
      createdAt: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const meta = await loadCloudinaryMeta();

  // Group per category
  type Stats = {
    visible: number;
    hidden: number;
    totalImgs: number;
    visImgs: number;
    hiddenImgs: number;
    totalBytes: number;
    visBytes: number;
    listingFirstBytes: number; // bytes voor eerste 24 producten (1 listing page load)
    oversized: { slug: string; pid: string; kb: number }[];
    maxPerProduct: { slug: string; count: number };
    missingDims: number;
  };
  const byCat = new Map<string, Stats>();

  for (const p of products) {
    const stats = byCat.get(p.category) ?? {
      visible: 0,
      hidden: 0,
      totalImgs: 0,
      visImgs: 0,
      hiddenImgs: 0,
      totalBytes: 0,
      visBytes: 0,
      listingFirstBytes: 0,
      oversized: [],
      maxPerProduct: { slug: "", count: 0 },
      missingDims: 0,
    };

    const imgs = parseImages(p.images);
    if (p.hidden) { stats.hidden++; stats.hiddenImgs += imgs.length; }
    else { stats.visible++; stats.visImgs += imgs.length; }
    stats.totalImgs += imgs.length;

    if (imgs.length > stats.maxPerProduct.count) {
      stats.maxPerProduct = { slug: p.slug, count: imgs.length };
    }

    // Bytes berekening + oversized scan
    let productBytes = 0;
    for (const img of imgs) {
      const pid = extractPublicId(img.url);
      if (!pid) continue;
      const m = meta.get(pid);
      if (!m) continue;
      productBytes += m.bytes;
      if (m.bytes >= OVERSIZED_BYTES) {
        stats.oversized.push({ slug: p.slug, pid, kb: Math.round(m.bytes / 1024) });
      }
      if (!img.w || !img.h) stats.missingDims++;
    }
    stats.totalBytes += productBytes;
    if (!p.hidden) stats.visBytes += productBytes;

    byCat.set(p.category, stats);
  }

  // Listing-page byte-load: pak eerste 24 zichtbare producten per cat (alfabetisch
  // = approximaat — werkelijke sort is featured+createdAt, maar ratio klopt)
  const visibleByCat = new Map<string, typeof products>();
  for (const p of products) {
    if (p.hidden) continue;
    const arr = visibleByCat.get(p.category) ?? [];
    arr.push(p);
    visibleByCat.set(p.category, arr);
  }
  for (const [cat, list] of visibleByCat.entries()) {
    const first24 = list.slice(0, MAX_VISIBLE_PER_LISTING);
    let bytes = 0;
    for (const p of first24) {
      const imgs = parseImages(p.images);
      // Op listing wordt alleen de hero (img[0]) gerendered
      const first = imgs[0];
      if (!first) continue;
      const pid = extractPublicId(first.url);
      if (!pid) continue;
      const m = meta.get(pid);
      if (m) bytes += m.bytes;
    }
    const stats = byCat.get(cat);
    if (stats) stats.listingFirstBytes = bytes;
  }

  // Print
  console.log("CATEGORIE        VIS  HIDDEN  IMGS  AVG/P  MAX/P (slug)         LISTING-PAGE  OVERSIZED  MISSING-DIMS");
  console.log("─".repeat(115));

  const sorted = Array.from(byCat.entries()).sort((a, b) => b[1].visible - a[1].visible);
  for (const [cat, s] of sorted) {
    const avg = s.visible > 0 ? (s.visImgs / s.visible).toFixed(1) : "—";
    const listingKB = (s.listingFirstBytes / 1024).toFixed(0);
    const oversizedCount = s.oversized.length;
    const maxStr = `${s.maxPerProduct.count.toString().padStart(2)} (${s.maxPerProduct.slug.slice(0, 20)})`;
    console.log(
      `  ${cat.padEnd(16)} ${s.visible.toString().padStart(3)}  ${s.hidden.toString().padStart(6)}  ${s.visImgs.toString().padStart(4)}  ${avg.padStart(5)}  ${maxStr.padEnd(28)} ${listingKB.padStart(7)}KB  ${oversizedCount.toString().padStart(8)}  ${s.missingDims.toString().padStart(12)}`,
    );
  }

  // Detail: oversized images per category
  console.log("\n─── Oversized images (>500KB) per categorie ───");
  for (const [cat, s] of sorted) {
    if (s.oversized.length === 0) continue;
    console.log(`\n${cat}:  ${s.oversized.length} foto's >500KB`);
    const top = s.oversized.sort((a, b) => b.kb - a.kb).slice(0, 5);
    for (const o of top) console.log(`  ${o.kb.toString().padStart(5)}KB  ${o.pid}`);
    if (s.oversized.length > 5) console.log(`  ... en ${s.oversized.length - 5} meer`);
  }

  // Categorieën die mogelijk opruim verdienen
  console.log("\n─── Cleanup kandidaten ───");
  for (const [cat, s] of sorted) {
    const issues: string[] = [];
    if (s.hidden > 0) issues.push(`${s.hidden} hidden producten (${s.hiddenImgs} foto's)`);
    if (s.maxPerProduct.count > 8) issues.push(`product met ${s.maxPerProduct.count} foto's: ${s.maxPerProduct.slug}`);
    if (s.oversized.length > 5) issues.push(`${s.oversized.length} oversized foto's`);
    if (s.listingFirstBytes > 5 * 1024 * 1024) issues.push(`listing >5MB (${(s.listingFirstBytes / 1024 / 1024).toFixed(1)}MB)`);
    if (issues.length > 0) {
      console.log(`  ${cat}: ${issues.join(", ")}`);
    }
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
