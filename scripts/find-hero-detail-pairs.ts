// Zoek producten met "hero" EN "detail-1" (etc.) in publicIds.
// Print de pids met bytes/dims naast elkaar zodat user visueel kan vergelijken.
//
// Run: npx tsx scripts/find-hero-detail-pairs.ts

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

async function listAll(): Promise<Map<string, Asset>> {
  const m = new Map<string, Asset>();
  let cursor: string | undefined;
  do {
    const r = await cloudinary.api.resources({
      type: "upload",
      prefix: "mokka",
      max_results: 500,
      next_cursor: cursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const item of r.resources) {
      m.set(item.public_id, {
        public_id: item.public_id,
        bytes: item.bytes ?? 0,
        width: item.width,
        height: item.height,
      });
    }
    cursor = r.next_cursor;
  } while (cursor);
  return m;
}

async function main() {
  console.log("\n═══ Producten met hero + detail-X foto's ═══\n");

  const assets = await listAll();
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { slug: true, name: true, hidden: true, images: true },
  });

  let found = 0;
  for (const p of products) {
    const imgs = parseImages(p.images).map((i) => extractPublicId(i.url)).filter((x): x is string => !!x);
    const hasHero = imgs.some((id) => /\/hero($|[/.])/.test(id) || id.endsWith("/hero"));
    const hasDetail = imgs.some((id) => /\/detail-\d/.test(id));
    if (!hasHero || !hasDetail) continue;

    found++;
    const flag = p.hidden ? "[HIDDEN]" : "[ZICHTBAAR]";
    console.log(`${flag} ${p.slug}  (${p.name})`);
    for (const id of imgs) {
      const a = assets.get(id);
      if (!a) {
        console.log(`  ${id}  [niet op Cloudinary]`);
        continue;
      }
      const kb = (a.bytes / 1024).toFixed(0);
      const dim = a.width && a.height ? `${a.width}×${a.height}` : "?";
      const role = id.endsWith("/hero") ? "HERO   " : /\/detail-\d/.test(id) ? "DETAIL " : "OTHER  ";
      console.log(`  ${role} ${kb.padStart(5)}KB ${dim.padEnd(11)}  ${id}`);
    }
    console.log("");
  }

  console.log(`\nTotaal producten met hero + detail naming: ${found}`);
  console.log("Als bytes + dims voor hero/detail-X gelijk zijn → likely visueel duplicaat.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
