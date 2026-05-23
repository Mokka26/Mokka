// Vind waarschijnlijke duplicaten binnen één productfolder via (bytes, dims).
// Twee foto's met exact zelfde grootte + dimensies en gedeeld product zijn
// hoogstwaarschijnlijk visueel identiek (zelfde foto, hernoemd of opnieuw
// geüpload).
//
// Run:
//   npx tsx scripts/find-visual-duplicates.ts

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

type Asset = { public_id: string; bytes: number; width?: number; height?: number };

async function listAll(): Promise<Asset[]> {
  const out: Asset[] = [];
  let cursor: string | undefined;
  do {
    const r = await cloudinary.api.resources({
      type: "upload",
      prefix: "mokka",
      max_results: 500,
      next_cursor: cursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const item of r.resources) {
      out.push({
        public_id: item.public_id,
        bytes: item.bytes ?? 0,
        width: item.width,
        height: item.height,
      });
    }
    cursor = r.next_cursor;
  } while (cursor);
  return out;
}

async function main() {
  console.log("\n═══ Visueel-duplicaten (bytes + dims match) ═══\n");

  const assets = await listAll();

  // Index op publicId
  const byPid = new Map<string, Asset>();
  for (const a of assets) byPid.set(a.public_id, a);

  // Per product (zichtbaar + hidden, niet deleted): kijk naar zijn DB-images
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { slug: true, name: true, hidden: true, images: true },
  });

  const suspectGroups: {
    productSlug: string;
    productName: string;
    hidden: boolean;
    pairs: { pids: string[]; bytes: number; dim: string }[];
  }[] = [];

  for (const p of products) {
    const imgs = parseImages(p.images);
    if (imgs.length < 2) continue;

    // Cluster product's images op (bytes, w, h)
    const byKey = new Map<string, string[]>();
    for (const img of imgs) {
      const pid = extractPublicId(img.url);
      if (!pid) continue;
      const a = byPid.get(pid);
      if (!a) continue;
      const key = `${a.bytes}|${a.width}x${a.height}`;
      const arr = byKey.get(key) ?? [];
      arr.push(pid);
      byKey.set(key, arr);
    }

    const productPairs: { pids: string[]; bytes: number; dim: string }[] = [];
    for (const [key, pids] of byKey.entries()) {
      if (pids.length < 2) continue;
      const [bytes, dim] = key.split("|");
      productPairs.push({ pids, bytes: parseInt(bytes), dim });
    }

    if (productPairs.length > 0) {
      suspectGroups.push({
        productSlug: p.slug,
        productName: p.name,
        hidden: p.hidden,
        pairs: productPairs,
      });
    }
  }

  console.log(`Producten met verdachte duplicaten: ${suspectGroups.length}\n`);

  let totalWaste = 0;
  let totalDupes = 0;

  for (const g of suspectGroups) {
    const flag = g.hidden ? "[HIDDEN]" : "[ZICHTBAAR]";
    console.log(`${flag} ${g.productSlug}  (${g.productName})`);
    for (const pair of g.pairs) {
      const sizeKB = (pair.bytes / 1024).toFixed(0);
      console.log(`  ${pair.pids.length}× ${sizeKB}KB ${pair.dim}`);
      for (const pid of pair.pids) {
        console.log(`    - ${pid}`);
      }
      totalWaste += pair.bytes * (pair.pids.length - 1);
      totalDupes += pair.pids.length - 1;
    }
    console.log("");
  }

  console.log(`─── Samenvatting ───`);
  console.log(`  Verdachte duplicate-paren in: ${suspectGroups.length} producten`);
  console.log(`  Extra foto's (te dedupliceren): ${totalDupes}`);
  console.log(`  Geschatte besparing: ${(totalWaste / 1024 / 1024).toFixed(1)} MB`);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
