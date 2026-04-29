/**
 * Eenmalig: voor elke productfoto in de DB, fetch de Cloudinary smart-cropped
 * 1:1 versie en upload die als nieuwe asset met suffix `_sq`. Update Product.images
 * naar de nieuwe URLs. Originelen blijven bestaan als backup.
 *
 * Gebruik:
 *   npx tsx scripts/bake-square-images.ts
 *
 * Idempotent: skipt foto's die al op `_sq` eindigen.
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
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const TARGET_W = 1200;

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

function extractPublicId(url: string): string | null {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return null;
  const after = url.split("/upload/")[1];
  if (!after) return null;
  const noVersion = after.replace(/^v\d+\//, "");
  const segments = noVersion.split("/");
  const isTransformSegment = (s: string) => /^[a-z]_/.test(s) || s.includes(",");
  while (segments.length > 1 && isTransformSegment(segments[0])) {
    segments.shift();
  }
  const last = segments[segments.length - 1];
  const dot = last.lastIndexOf(".");
  if (dot > 0) segments[segments.length - 1] = last.slice(0, dot);
  return segments.join("/");
}

async function tryUpload(derivedUrl: string, newPid: string) {
  return cloudinary.uploader.upload(derivedUrl, {
    public_id: newPid,
    overwrite: true,
    resource_type: "image",
  });
}

async function processImage(img: ProductImage): Promise<ProductImage> {
  const pid = extractPublicId(img.url);
  if (!pid) return img;

  // Skip al gebakken foto's — alleen originelen (re)try'en
  if (pid.endsWith("_sq")) return img;

  const origPid = pid;
  const newPid = `${origPid}_sq`;
  const genFillUrl = `https://res.cloudinary.com/${CLOUD}/image/upload/c_pad,b_gen_fill,ar_1:1,w_${TARGET_W},f_jpg,q_auto/${origPid}`;
  const padUrl = `https://res.cloudinary.com/${CLOUD}/image/upload/c_pad,b_auto,ar_1:1,w_${TARGET_W},f_jpg,q_auto/${origPid}`;

  // Probeer eerst gen_fill (mooiste resultaat). Bij 400 fallback naar b_auto.
  for (const url of [genFillUrl, padUrl]) {
    try {
      const uploaded = await tryUpload(url, newPid);
      return { url: uploaded.secure_url, w: uploaded.width, h: uploaded.height };
    } catch (err: unknown) {
      const e = err as { message?: string; http_code?: number; error?: { message?: string } };
      if (e.http_code === 404) {
        console.error(`\n  ${origPid}: bron niet gevonden (404)`);
        return img;
      }
      // 400 of andere → probeer volgende fallback
      if (url === padUrl) {
        const msg = e.error?.message ?? e.message ?? "onbekend";
        console.error(`\n  ${origPid}: alle modes falen (${e.http_code ?? "?"}): ${msg}`);
        return img;
      }
    }
  }
  return img;
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
  let totalImgs = 0;
  let baked = 0;
  let skipped = 0;

  for (const p of products) {
    const imgs = parseImages(p.images);
    if (imgs.length === 0) continue;

    process.stdout.write(`${p.slug.padEnd(40)} (${imgs.length}): `);
    const updated: ProductImage[] = [];
    for (const img of imgs) {
      totalImgs++;
      const pid = extractPublicId(img.url);
      if (!pid) {
        skipped++;
        updated.push(img);
        process.stdout.write("s");
        continue;
      }
      const result = await processImage(img);
      if (result.url !== img.url) {
        baked++;
        process.stdout.write("+");
      } else {
        process.stdout.write("x");
      }
      updated.push(result);
    }

    await prisma.product.update({
      where: { id: p.id },
      data: { images: JSON.stringify(updated) },
    });
    console.log(" ok");
  }

  console.log(`\n${baked} foto's getransformeerd, ${skipped} overgeslagen, ${totalImgs - baked - skipped} gefaald`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
