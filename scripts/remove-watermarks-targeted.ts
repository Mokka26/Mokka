/**
 * Pas e_gen_remove toe op alleen de 6 banken met watermarks.
 * Daarna pre-baked elke URL zodat Cloudinary direct cached.
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface ImageEntry { url: string; w?: number; h?: number }

const TARGET_SLUGS = [
  "kingstone-genova-texarm-u-bank",
  "rosso-soro-loungebank",
  "bonna-monolith-loungebank",
  "star-preston-c-loungebank",
  "star-croco-loungebank",
  "california-magic-loungebank",
];

const PROMPT = encodeURIComponent("text watermark logo brand name overlay").replace(/%2C/g, "%20");

function addGenRemove(url: string): string {
  if (!url.includes("/upload/")) return url;
  if (url.includes("e_gen_remove")) return url;
  return url.replace("/upload/", `/upload/e_gen_remove:prompt_(${PROMPT})/`);
}

const products = await prisma.product.findMany({
  where: { slug: { in: TARGET_SLUGS } },
  select: { id: true, slug: true, images: true },
});

console.log(`${products.length} target producten gevonden.\n`);

const allNewUrls: Array<{ slug: string; url: string }> = [];
for (const p of products) {
  let imgs: ImageEntry[] = [];
  try { imgs = JSON.parse(p.images) ?? []; } catch { continue; }

  const newImgs = imgs.map((i) => ({ ...i, url: addGenRemove(i.url) }));
  await prisma.product.update({
    where: { id: p.id },
    data: { images: JSON.stringify(newImgs) },
  });
  for (const i of newImgs) allNewUrls.push({ slug: p.slug, url: i.url });
  console.log(`  ${p.slug.padEnd(35)} ${newImgs.length} foto(s) → gen_remove URL`);
}

console.log(`\n=== Pre-bake ${allNewUrls.length} URLs zodat Cloudinary ze cached ===\n`);

let ok = 0;
let failed = 0;
for (let i = 0; i < allNewUrls.length; i++) {
  const { slug, url } = allNewUrls[i];
  let success = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) { success = true; break; }
      if (attempt < 4) await new Promise((r) => setTimeout(r, 5000 + attempt * 3000));
    } catch {
      if (attempt < 4) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  if (success) {
    ok++;
    console.log(`  ${i + 1}/${allNewUrls.length} ✓ ${slug}`);
  } else {
    failed++;
    console.log(`  ${i + 1}/${allNewUrls.length} ✗ ${slug}`);
  }
}

console.log(`\n${ok}/${allNewUrls.length} cached, ${failed} failed`);
await prisma.$disconnect();
