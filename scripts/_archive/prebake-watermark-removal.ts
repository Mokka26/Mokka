/**
 * Pre-bake alle e_gen_remove URLs zodat Cloudinary ze cached vóór user-visit.
 * Daarna zijn alle requests CDN-cache hits = direct.
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

const products = await prisma.$queryRaw<Array<{ slug: string; images: string }>>`
  SELECT slug, images FROM "Product"
  WHERE category IN ('banken','hoekbanken') AND hidden = false
`;

const urls: Array<{ slug: string; url: string }> = [];
for (const p of products) {
  try {
    const imgs = JSON.parse(p.images) as Array<{ url: string }>;
    for (const i of imgs) {
      if (i.url && i.url.includes("e_gen_remove")) {
        urls.push({ slug: p.slug, url: i.url });
      }
    }
  } catch {}
}

console.log(`Pre-bake ${urls.length} URLs...\n`);

let ok = 0;
let failed = 0;
for (let i = 0; i < urls.length; i++) {
  const { slug, url } = urls[i];
  // Probeer met retry — eerste call kan ~10-30s duren, daarna instant
  let success = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        success = true;
        break;
      }
      // 423 = locked (processing), 4xx/5xx = retry
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 5000 + attempt * 3000));
      }
    } catch {
      if (attempt < 4) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  if (success) {
    ok++;
    process.stdout.write(`  ${i + 1}/${urls.length} ✓ ${slug}\n`);
  } else {
    failed++;
    process.stdout.write(`  ${i + 1}/${urls.length} ✗ ${slug} (${url.slice(-60)})\n`);
  }
}

console.log(`\n${ok} cached, ${failed} failed`);
await prisma.$disconnect();
