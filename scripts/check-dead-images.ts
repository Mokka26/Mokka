// Scant alle product-images en rapporteert dode URLs.
// HEAD-request op de ORIGINELE Cloudinary-URL (zonder transforms) —
// dat is wat we willen weten: bestaat het asset nog?
//
// Run:
//   npx tsx scripts/check-dead-images.ts
//   npx tsx scripts/check-dead-images.ts --concurrency=8
//   npx tsx scripts/check-dead-images.ts --fix       # verwijder dode URLs uit product.images

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

const args = process.argv.slice(2);
const concurrency = parseInt(
  args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? "5",
  10,
);
const fix = args.includes("--fix");

interface DeadImage {
  productId: string;
  slug: string;
  productName: string;
  url: string;
  status: number | "error";
}

async function check(url: string): Promise<number | "error"> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(15_000),
    });
    return r.status;
  } catch {
    return "error";
  }
}

async function main() {
  console.log("\n═══ Scan dode product-image URLs ═══\n");
  if (fix) console.log("⚠ --fix actief — dode URLs worden uit DB verwijderd\n");

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true, images: true },
  });

  // Plat lijst: alle (product, url) paren
  const pairs: { productId: string; slug: string; productName: string; url: string }[] = [];
  for (const p of products) {
    const imgs = parseImages(p.images);
    for (const img of imgs) {
      if (img.url) pairs.push({ productId: p.id, slug: p.slug, productName: p.name, url: img.url });
    }
  }

  console.log(`Producten: ${products.length}, te checken URLs: ${pairs.length}\n`);

  const dead: DeadImage[] = [];
  let done = 0;
  const start = Date.now();

  for (let i = 0; i < pairs.length; i += concurrency) {
    const batch = pairs.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (p) => ({ ...p, status: await check(p.url) })),
    );
    for (const r of results) {
      done++;
      // 4xx of network-error = dood. 2xx + 3xx = leeft.
      const isDead =
        r.status === "error" ||
        (typeof r.status === "number" && r.status >= 400);
      if (isDead) {
        dead.push(r);
        console.log(`  ✗ ${r.slug} → ${r.status}  ${r.url.slice(-60)}`);
      }
    }
    if (done % 50 === 0 || done === pairs.length) {
      const elapsed = (Date.now() - start) / 1000;
      process.stdout.write(
        `  voortgang: ${done}/${pairs.length}  dode=${dead.length}  ${elapsed.toFixed(0)}s\n`,
      );
    }
  }

  console.log(`\n═══ Resultaat ═══`);
  console.log(`Totaal: ${pairs.length} URLs, ${dead.length} dood`);

  if (dead.length === 0) {
    console.log("✓ Alle URLs leven. Geen actie nodig.");
    process.exit(0);
  }

  // Groepeer per product
  const perProduct = new Map<string, DeadImage[]>();
  for (const d of dead) {
    if (!perProduct.has(d.productId)) perProduct.set(d.productId, []);
    perProduct.get(d.productId)!.push(d);
  }

  console.log(`\nGetroffen producten: ${perProduct.size}\n`);
  for (const [, items] of perProduct.entries()) {
    console.log(`  ${items[0].slug}  (${items[0].productName})`);
    for (const it of items) console.log(`    ✗ ${it.url}`);
  }

  if (!fix) {
    console.log("\nGeen wijzigingen doorgevoerd. Run met --fix om dode URLs uit DB te halen.");
    process.exit(0);
  }

  console.log("\n--fix actief, dode URLs verwijderen uit product.images...");
  for (const [productId, items] of perProduct.entries()) {
    const product = products.find((p) => p.id === productId)!;
    const all = parseImages(product.images);
    const deadUrls = new Set(items.map((i) => i.url));
    const kept = all.filter((img) => !deadUrls.has(img.url));
    await prisma.product.update({
      where: { id: productId },
      data: { images: JSON.stringify(kept) },
    });
    console.log(`  ✓ ${product.slug}: ${all.length} → ${kept.length} images`);
  }

  console.log("\n✓ Klaar.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
