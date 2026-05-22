// Bredere image-usage audit dan orphan-check.
// Laat zien WAAR de 1826 assets staan: zichtbaar, verborgen, soft-deleted,
// of in producten met overdadig veel foto's (waar de extra's UI-onzichtbaar zijn).
//
// Run:
//   npx tsx scripts/audit-image-usage.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

async function main() {
  console.log("\n═══ Image usage audit ═══\n");

  // Alle producten — incl. hidden + soft-deleted
  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      images: true,
      hidden: true,
      deletedAt: true,
      stock: true,
    },
  });

  const deletedImages = await prisma.deletedImage.findMany({
    select: { url: true, productSlug: true, deletedAt: true },
  });

  // Tellingen
  const stats = {
    products: { total: 0, visible: 0, hidden: 0, soft_deleted: 0, out_of_stock: 0 },
    images: { visible: 0, hidden: 0, soft_deleted: 0, in_trash_queue: 0 },
    perProduct: { max: 0, maxSlug: "", avg: 0, distribution: {} as Record<string, number> },
  };

  let totalImages = 0;
  const counts: number[] = [];

  for (const p of products) {
    stats.products.total++;
    const imgs = parseImages(p.images);
    const n = imgs.length;
    totalImages += n;
    counts.push(n);

    if (n > stats.perProduct.max) {
      stats.perProduct.max = n;
      stats.perProduct.maxSlug = p.slug;
    }
    const bucket =
      n === 0 ? "0" :
      n <= 2 ? "1-2" :
      n <= 5 ? "3-5" :
      n <= 10 ? "6-10" :
      n <= 20 ? "11-20" : "21+";
    stats.perProduct.distribution[bucket] = (stats.perProduct.distribution[bucket] ?? 0) + 1;

    if (p.deletedAt) {
      stats.products.soft_deleted++;
      stats.images.soft_deleted += n;
    } else if (p.hidden) {
      stats.products.hidden++;
      stats.images.hidden += n;
    } else {
      stats.products.visible++;
      stats.images.visible += n;
      if ((p.stock ?? 0) === 0) stats.products.out_of_stock++;
    }
  }

  stats.images.in_trash_queue = deletedImages.length;
  stats.perProduct.avg = totalImages / products.length;

  console.log("─── Producten ───");
  console.log(`  Totaal:       ${stats.products.total}`);
  console.log(`  Zichtbaar:    ${stats.products.visible}  (waarvan ${stats.products.out_of_stock} uitverkocht)`);
  console.log(`  Verborgen:    ${stats.products.hidden}  (niet op site)`);
  console.log(`  Soft-deleted: ${stats.products.soft_deleted}  (prullenbak, 30d retentie)`);

  console.log("\n─── Image-verdeling (per status) ───");
  console.log(`  Op zichtbare producten:  ${stats.images.visible}`);
  console.log(`  Op verborgen producten:  ${stats.images.hidden}  ← bezet ruimte, niet op site`);
  console.log(`  Op soft-deleted:         ${stats.images.soft_deleted}  ← auto-purged na 30d`);
  console.log(`  In DeletedImage queue:   ${stats.images.in_trash_queue}  ← wachten op purge-cron`);

  console.log("\n─── Foto's per product ───");
  console.log(`  Gemiddeld:  ${stats.perProduct.avg.toFixed(1)} foto's/product`);
  console.log(`  Maximum:    ${stats.perProduct.max} foto's  (${stats.perProduct.maxSlug})`);
  console.log("\n  Verdeling:");
  const order = ["0", "1-2", "3-5", "6-10", "11-20", "21+"];
  for (const bucket of order) {
    const c = stats.perProduct.distribution[bucket] ?? 0;
    const bar = "█".repeat(Math.floor(c / 5));
    console.log(`    ${bucket.padEnd(8)} ${c.toString().padStart(4)} ${bar}`);
  }

  // Top 10 producten met meeste foto's
  console.log("\n─── Top 10 producten met meeste foto's ───");
  const sorted = products
    .map((p) => ({ slug: p.slug, name: p.name, count: parseImages(p.images).length, hidden: p.hidden, deleted: !!p.deletedAt }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  for (const p of sorted) {
    const flag = p.deleted ? "[DELETED]" : p.hidden ? "[HIDDEN]" : "[ZICHTBAAR]";
    console.log(`  ${p.count.toString().padStart(3)}  ${flag.padEnd(11)}  ${p.slug}`);
  }

  // Verborgen producten — kandidaat voor handmatige opruim
  if (stats.products.hidden > 0) {
    console.log(`\n─── ${stats.products.hidden} verborgen producten (mogelijk opruimen) ───`);
    const hiddenList = products
      .filter((p) => p.hidden && !p.deletedAt)
      .map((p) => ({ slug: p.slug, count: parseImages(p.images).length }))
      .sort((a, b) => b.count - a.count);
    for (const p of hiddenList.slice(0, 20)) {
      console.log(`  ${p.count.toString().padStart(3)} foto's  ${p.slug}`);
    }
    if (hiddenList.length > 20) {
      console.log(`  ... en ${hiddenList.length - 20} meer`);
    }
  }

  console.log("\n✓ Klaar.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
