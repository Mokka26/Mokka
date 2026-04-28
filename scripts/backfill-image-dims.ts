/**
 * Eenmalig: haalt voor elke productfoto in de DB de dimensies (width, height)
 * op via de Cloudinary admin API en schrijft ze terug naar Product.images
 * in het nieuwe formaat: [{url, w, h}, ...].
 *
 * Gebruik:
 *   npx tsx scripts/backfill-image-dims.ts
 *
 * Idempotent: producten die al het nieuwe formaat hebben worden
 * overgeslagen.
 */

import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";

config({ path: ".env.local" });

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();

type ProductImage = { url: string; w?: number; h?: number };

function parseImages(raw: string): ProductImage[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((item): ProductImage[] => {
      if (typeof item === "string") return [{ url: item }];
      if (item && typeof item === "object" && typeof item.url === "string") {
        return [
          {
            url: item.url,
            w: typeof item.w === "number" ? item.w : undefined,
            h: typeof item.h === "number" ? item.h : undefined,
          },
        ];
      }
      return [];
    });
  } catch {
    return [];
  }
}

/**
 * Extraheer de Cloudinary public_id uit een secure URL.
 *
 * Format: https://res.cloudinary.com/{cloud}/image/upload/[transforms/][v123/]{public_id}.{ext}
 */
function extractPublicId(url: string): string | null {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return null;
  const after = url.split("/upload/")[1];
  if (!after) return null;
  // Strip version segment (vNNNN/)
  const noVersion = after.replace(/^v\d+\//, "");
  // Strip transformaties (segmenten met komma's voor het pad)
  const segments = noVersion.split("/");
  // Eerste segment kan transforms zijn (heeft komma's of underscore-prefixes als c_, f_, q_)
  const isTransformSegment = (s: string) =>
    /^[a-z]_/.test(s) || s.includes(",");
  while (segments.length > 1 && isTransformSegment(segments[0])) {
    segments.shift();
  }
  // Verwijder file-extensie van laatste segment
  const last = segments[segments.length - 1];
  const dot = last.lastIndexOf(".");
  if (dot > 0) segments[segments.length - 1] = last.slice(0, dot);
  return segments.join("/");
}

async function getDims(publicId: string): Promise<{ w: number; h: number } | null> {
  try {
    const res = await cloudinary.api.resource(publicId, { resource_type: "image" });
    if (typeof res.width === "number" && typeof res.height === "number") {
      return { w: res.width, h: res.height };
    }
    return null;
  } catch (err) {
    console.error(`  fout bij ophalen ${publicId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function main() {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("Cloudinary credentials ontbreken in .env.local");
    process.exit(1);
  }

  const products = await prisma.product.findMany({
    select: { id: true, slug: true, images: true },
  });

  console.log(`Scan ${products.length} producten...\n`);
  let touched = 0;
  let already = 0;
  let failed = 0;

  for (const p of products) {
    const imgs = parseImages(p.images);
    const needsDims = imgs.some((i) => !i.w || !i.h);
    if (!needsDims) {
      already++;
      continue;
    }

    process.stdout.write(`${p.slug} (${imgs.length} fotos): `);
    const updated: ProductImage[] = [];
    for (const img of imgs) {
      if (img.w && img.h) {
        updated.push(img);
        process.stdout.write(".");
        continue;
      }
      const publicId = extractPublicId(img.url);
      if (!publicId) {
        // Niet-Cloudinary URL — laat staan
        updated.push(img);
        process.stdout.write("s");
        continue;
      }
      const dims = await getDims(publicId);
      if (dims) {
        updated.push({ url: img.url, w: dims.w, h: dims.h });
        process.stdout.write("+");
      } else {
        updated.push(img);
        failed++;
        process.stdout.write("x");
      }
    }

    await prisma.product.update({
      where: { id: p.id },
      data: { images: JSON.stringify(updated) },
    });
    touched++;
    console.log(" ok");
  }

  console.log(`\nKlaar: ${touched} bijgewerkt, ${already} al actueel, ${failed} foto's gefaald`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
