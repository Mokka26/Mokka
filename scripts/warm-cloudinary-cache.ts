// Pre-warm Cloudinary's edge-cache voor alle product images.
// Doet HEAD-requests op de exact-same URLs die ProductCard + PDP
// renderen — Cloudinary genereert de transformed assets en cached ze.
//
// Run na elke deploy (of na grote image-imports):
//   npx tsx scripts/warm-cloudinary-cache.ts
//   npx tsx scripts/warm-cloudinary-cache.ts --concurrency=8

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";
import { cldOptimize } from "@/lib/cloudinary-url";

const args = process.argv.slice(2);
const concurrency = parseInt(
  args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? "5",
  10,
);

// Dezelfde transformatie-presets als in productie-componenten
function buildUrls(images: { url: string; w?: number; h?: number }[]): string[] {
  if (images.length === 0) return [];
  const first = images[0];
  const isPortrait = !!(first.w && first.h && first.h > first.w * 1.1);
  const urls: string[] = [];

  // ProductCard hero (w=2000, 3:2)
  urls.push(
    cldOptimize(first.url, {
      ar: "3:2",
      w: 2000,
      mode: isPortrait ? "pad" : "fill",
      upscale: !isPortrait,
      quality: "auto:best",
    }),
  );

  // PDP desktop main (w=2400, 3:2)
  urls.push(
    cldOptimize(first.url, {
      ar: "3:2",
      w: 2400,
      mode: isPortrait ? "pad" : "fill",
      upscale: !isPortrait,
      quality: "auto:best",
    }),
  );

  // PDP mobile carousel (w=2200) — voor alle images
  for (const [i, img] of images.entries()) {
    const portrait = !!(img.w && img.h && img.h > img.w * 1.1);
    urls.push(
      cldOptimize(img.url, {
        ar: "3:2",
        w: 2200,
        mode: portrait ? "pad" : "fill",
        upscale: !portrait,
        quality: "auto:best",
      }),
    );
    // Thumb (w=320)
    urls.push(
      cldOptimize(img.url, {
        ar: "3:2",
        w: 320,
        mode: portrait ? "pad" : "fill",
        quality: "auto:best",
      }),
    );
    // Lightbox (w=2400 zonder ar)
    if (i < 3) {
      urls.push(
        cldOptimize(img.url, { w: 2400, upscale: true, quality: "auto:best" }),
      );
    }
  }
  return [...new Set(urls)];
}

async function warmOne(url: string): Promise<{ ok: boolean; ms: number; status?: number }> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(60_000) });
    return { ok: r.ok, ms: Date.now() - t0, status: r.status };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}

async function main() {
  console.log(`\n═══ Warm Cloudinary cache (concurrency=${concurrency}) ═══\n`);

  const products = await prisma.product.findMany({
    where: { hidden: false, deletedAt: null },
    select: { slug: true, images: true },
  });

  const allUrls: string[] = [];
  for (const p of products) {
    const imgs = parseImages(p.images);
    allUrls.push(...buildUrls(imgs));
  }
  const unique = [...new Set(allUrls)];
  console.log(`Producten: ${products.length}, unieke URLs: ${unique.length}\n`);

  let done = 0;
  let ok = 0;
  let fail = 0;
  let totalMs = 0;
  const start = Date.now();

  // Process in batches of `concurrency`
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(warmOne));
    for (const r of results) {
      done++;
      if (r.ok) ok++;
      else fail++;
      totalMs += r.ms;
    }
    if (done % 50 === 0 || done === unique.length) {
      const elapsed = (Date.now() - start) / 1000;
      const rate = done / elapsed;
      const eta = (unique.length - done) / rate;
      process.stdout.write(
        `  ${done}/${unique.length}  ok=${ok}  fail=${fail}  rate=${rate.toFixed(1)}/s  eta=${eta.toFixed(0)}s\n`,
      );
    }
  }

  const avgMs = totalMs / done;
  console.log(
    `\n✓ Klaar. ok=${ok} fail=${fail} avg=${avgMs.toFixed(0)}ms total=${((Date.now() - start) / 1000).toFixed(1)}s`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
