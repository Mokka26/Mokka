/**
 * Revert: vervangt _sq URLs in Product.images terug naar de originele URLs.
 * De _sq Cloudinary assets blijven bestaan (geen verwijdering, gewoon
 * niet meer gebruikt door DB).
 *
 * Gebruik:
 *   npx tsx scripts/revert-square-bake.ts
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

async function getOriginalDims(publicId: string): Promise<{ w: number; h: number } | null> {
  try {
    const r = await cloudinary.api.resource(publicId, { resource_type: "image" });
    if (typeof r.width === "number" && typeof r.height === "number") {
      return { w: r.width, h: r.height };
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, images: true },
  });

  console.log(`Scan ${products.length} producten...\n`);
  let reverted = 0;

  for (const p of products) {
    const imgs = parseImages(p.images);
    let changed = false;
    const updated: ProductImage[] = [];

    for (const img of imgs) {
      const pid = extractPublicId(img.url);
      if (!pid || !pid.endsWith("_sq")) {
        updated.push(img);
        continue;
      }
      const origPid = pid.slice(0, -3);
      const origUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${origPid}.jpg`;
      const dims = await getOriginalDims(origPid);
      updated.push({ url: origUrl, w: dims?.w, h: dims?.h });
      changed = true;
      reverted++;
      process.stdout.write(".");
    }

    if (changed) {
      await prisma.product.update({
        where: { id: p.id },
        data: { images: JSON.stringify(updated) },
      });
      console.log(` ${p.slug} reverted`);
    }
  }

  console.log(`\n${reverted} foto's terug naar origineel`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
