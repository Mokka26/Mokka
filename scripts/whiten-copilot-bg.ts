// Voor Copilot foto's zonder witte achtergrond (uit audit-bank-photos):
//   - Pre-bake e_background_removal,b_white via cloudinary.uploader.upload(oldUrl, {transformation})
//   - Save als nieuw public_id "<oude>-white" in zelfde folder
//   - Update DB Product.images: vervang oude URL met nieuwe
//   - Oude assets blijven op Cloudinary (handmatig opruimen of via trash later)
//
// Run:
//   npx tsx scripts/whiten-copilot-bg.ts                # dry-run, alle ~34
//   npx tsx scripts/whiten-copilot-bg.ts --slug=bonna-monolith-loungebank
//   npx tsx scripts/whiten-copilot-bg.ts --apply
//   npx tsx scripts/whiten-copilot-bg.ts --apply --threshold=0.5  (default 0.4)

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";
import { v2 as cloudinary } from "cloudinary";
import { extractPublicId } from "@/lib/cloudinary-helpers";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const onlySlug = args.find((a) => a.startsWith("--slug="))?.split("=")[1];
const threshold = parseFloat(args.find((a) => a.startsWith("--threshold="))?.split("=")[1] ?? "0.4");

function isWhitish(hex: string): boolean {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r >= 235 && g >= 235 && b >= 235;
}

async function whiteRatio(publicId: string): Promise<number> {
  try {
    const r = await cloudinary.api.resource(publicId, {
      colors: true,
    } as Parameters<typeof cloudinary.api.resource>[1]);
    const colors = (r.colors ?? []) as [string, number][];
    if (!colors.length) return 1;
    return (
      colors
        .filter(([hex]) => isWhitish(hex))
        .reduce((s, [, pct]) => s + pct, 0) / 100
    );
  } catch {
    return 1; // bij fout: behandel als wit (skip)
  }
}

async function whitenAsset(oldPublicId: string): Promise<string | null> {
  // Build de transformed URL als source
  const sourceUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/e_background_removal/b_white/${oldPublicId}`;
  const newPublicId = `${oldPublicId.split("/").slice(-1)[0]}-white`;
  const folder = oldPublicId.split("/").slice(0, -1).join("/");

  const result = await cloudinary.uploader.upload(sourceUrl, {
    public_id: newPublicId,
    folder,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
  });
  return result.secure_url;
}

async function main() {
  console.log(`\n═══ Whiten Copilot backgrounds ═══`);
  console.log(`  Apply:     ${APPLY ? "YES (re-upload + DB)" : "no (dry-run)"}`);
  console.log(`  Threshold: ${threshold} (white-ratio onder dit = whitenen)\n`);

  const where = onlySlug ? { slug: onlySlug } : { deletedAt: null };
  const products = await prisma.product.findMany({
    where,
    select: { id: true, slug: true, images: true },
  });

  type Target = {
    slug: string;
    productId: string;
    oldUrl: string;
    publicId: string;
    whiteRatio: number;
  };
  const targets: Target[] = [];

  for (const p of products) {
    const imgs = parseImages(p.images);
    for (const img of imgs) {
      if (!/\/copilot-\d+/i.test(img.url)) continue;
      const pid = extractPublicId(img.url);
      if (!pid) continue;
      const wr = await whiteRatio(pid);
      if (wr < threshold) {
        targets.push({
          slug: p.slug,
          productId: p.id,
          oldUrl: img.url,
          publicId: pid,
          whiteRatio: wr,
        });
      }
    }
  }

  console.log(`Te whitenen: ${targets.length} foto's\n`);
  for (const t of targets) {
    console.log(`  ${t.slug}  ·  ${t.publicId}  ·  wit=${(t.whiteRatio * 100).toFixed(0)}%`);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Run met --apply.`);
    return;
  }

  console.log(`\n─── Whitenen + DB update ───`);

  // Groepeer per product om DB efficient te updaten
  const byProduct = new Map<string, Target[]>();
  for (const t of targets) {
    if (!byProduct.has(t.productId)) byProduct.set(t.productId, []);
    byProduct.get(t.productId)!.push(t);
  }

  for (const [productId, ts] of byProduct) {
    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true, images: true },
    });
    if (!p) continue;
    const imgs = parseImages(p.images);
    const urlMap = new Map<string, string>(); // oldUrl → newUrl

    for (const t of ts) {
      try {
        const newUrl = await whitenAsset(t.publicId);
        if (newUrl) {
          urlMap.set(t.oldUrl, newUrl);
          console.log(`  ✓ ${t.slug}  ${t.publicId} → ${newUrl.split("/upload/")[1]?.split("/").slice(-2).join("/")}`);
        }
      } catch (e) {
        console.error(`  ✗ ${t.publicId}: ${(e as Error).message}`);
      }
    }

    const newImgs = imgs.map((i) => {
      const replacement = urlMap.get(i.url);
      return replacement ? { url: replacement, w: i.w, h: i.h } : i;
    });

    await prisma.product.update({
      where: { id: productId },
      data: { images: JSON.stringify(newImgs) },
    });
    console.log(`  → DB: ${p.slug} update`);
  }

  console.log(`\n✓ Klaar.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
