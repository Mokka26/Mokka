// Test of de daadwerkelijke render-URLs (met e_upscale, c_fill, etc) werken.
// De gewone audit checkt raw URLs (200 OK) maar transformatie-URLs kunnen falen
// bij Cloudinary's upscale-limit (max 2x source).

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";
import { cldOptimize } from "@/lib/cloudinary-url";

async function head(url: string): Promise<number | "error"> {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) });
    return r.status;
  } catch {
    return "error";
  }
}

async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null, category: { in: ["banken", "hoekbanken"] } },
    select: { slug: true, images: true },
  });

  // Test elke image met de drie meest-gebruikte transformaties
  const transforms = [
    { name: "card-landscape", opts: { ar: "3:2", w: 1600, mode: "fill" as const, upscale: true, quality: "auto:best" as const } },
    { name: "card-portrait", opts: { ar: "3:2", w: 1600, mode: "pad" as const, quality: "auto:best" as const } },
    { name: "pdp-main", opts: { ar: "3:2", w: 2400, mode: "fill" as const, upscale: true, quality: "auto:best" as const } },
    { name: "lightbox", opts: { w: 2400, upscale: true, quality: "auto:best" as const } },
  ];

  const failures: { slug: string; transform: string; url: string; status: number | "error" }[] = [];
  let total = 0;

  for (const p of products) {
    const imgs = parseImages(p.images);
    for (const img of imgs) {
      for (const t of transforms) {
        const url = cldOptimize(img.url, t.opts);
        total += 1;
        const s = await head(url);
        if (s === "error" || (typeof s === "number" && s >= 400)) {
          failures.push({ slug: p.slug, transform: t.name, url, status: s });
        }
      }
    }
  }

  console.log(`\nGetest: ${total} URL-varianten over ${products.length} producten`);
  console.log(`Failures: ${failures.length}\n`);

  if (failures.length > 0) {
    console.log("─── Falende transforms ───");
    for (const f of failures) {
      console.log(`  [${f.status}] ${f.slug}  ·  ${f.transform}`);
      console.log(`    ${f.url.split("/upload/")[1] ?? f.url}`);
    }
  } else {
    console.log("✓ Alle transformaties OK");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
