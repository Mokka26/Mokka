// Verwijder detail-1 (en optioneel detail-2/3) waar hero bestaat — die zijn
// dezelfde foto als hero in lagere resolutie, dus redundant.
//
// Twee acties per product:
//   1. Strip de detail-X entries uit Product.images JSON (DB-update)
//   2. Destroy detail-X publicId op Cloudinary
//
// Run:
//   npx tsx scripts/remove-detail-duplicates.ts                     # dry-run, alleen detail-1
//   npx tsx scripts/remove-detail-duplicates.ts --apply             # apply detail-1 cleanup
//   npx tsx scripts/remove-detail-duplicates.ts --all-details       # dry-run incl detail-2/3/4...
//   npx tsx scripts/remove-detail-duplicates.ts --apply --all-details

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";
import { parseImages, type ProductImage } from "@/lib/imageHelpers";
import { extractPublicId } from "@/lib/cloudinary-helpers";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const APPLY = process.argv.includes("--apply");
const ALL_DETAILS = process.argv.includes("--all-details");

function isDetailMatch(publicId: string): boolean {
  if (ALL_DETAILS) return /\/detail-\d+$/.test(publicId);
  return /\/detail-1$/.test(publicId);
}

function isHero(publicId: string): boolean {
  return publicId.endsWith("/hero");
}

async function main() {
  console.log("\n═══ Remove detail-duplicates (hero + detail-X = zelfde foto) ═══");
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");
  console.log(ALL_DETAILS ? "Scope: ALLE detail-N\n" : "Scope: alleen detail-1\n");

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true, images: true },
  });

  type Plan = {
    product: { id: string; slug: string; name: string };
    keep: ProductImage[];
    remove: { url: string; pid: string }[];
  };
  const plans: Plan[] = [];

  for (const p of products) {
    const imgs = parseImages(p.images);
    if (imgs.length === 0) continue;

    // Check of er hero bestaat
    const hasHero = imgs.some((i) => {
      const pid = extractPublicId(i.url);
      return pid && isHero(pid);
    });
    if (!hasHero) continue;

    const keep: ProductImage[] = [];
    const remove: { url: string; pid: string }[] = [];
    for (const img of imgs) {
      const pid = extractPublicId(img.url);
      if (pid && isDetailMatch(pid)) {
        remove.push({ url: img.url, pid });
      } else {
        keep.push(img);
      }
    }
    if (remove.length === 0) continue;

    plans.push({ product: { id: p.id, slug: p.slug, name: p.name }, keep, remove });
  }

  let totalToRemove = 0;
  for (const p of plans) {
    totalToRemove += p.remove.length;
    console.log(`  ${p.product.slug}  (${p.product.name})`);
    for (const r of p.remove) console.log(`    × ${r.pid}`);
  }
  console.log(`\nTotaal producten geraakt: ${plans.length}`);
  console.log(`Totaal foto's te verwijderen: ${totalToRemove}`);

  if (!APPLY) {
    console.log("\nDry-run — geen mutaties. Run met --apply om uit te voeren.");
    process.exit(0);
  }

  console.log("\nUitvoeren...");
  let dbOk = 0, dbFail = 0, cldOk = 0, cldFail = 0;

  for (const p of plans) {
    // 1. Update Product.images JSON
    try {
      await prisma.product.update({
        where: { id: p.product.id },
        data: { images: JSON.stringify(p.keep) },
      });
      dbOk++;
    } catch (err) {
      dbFail++;
      console.log(`  ✗ DB ${p.product.slug}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    // 2. Destroy Cloudinary
    for (const r of p.remove) {
      try {
        const result = await cloudinary.uploader.destroy(r.pid, { invalidate: true });
        if (result.result === "ok" || result.result === "not found") cldOk++;
        else { cldFail++; console.log(`  ✗ Cloudinary ${r.pid}: ${result.result}`); }
      } catch (err) {
        cldFail++;
        console.log(`  ✗ Cloudinary ${r.pid}: ${err instanceof Error ? err.message : err}`);
      }
      await new Promise((res) => setTimeout(res, 30));
    }
    console.log(`  ✓ ${p.product.slug}`);
  }

  console.log(`\n─── Klaar ───`);
  console.log(`  DB-updates:           ${dbOk}/${plans.length}  (${dbFail} failed)`);
  console.log(`  Cloudinary destroys:  ${cldOk}/${totalToRemove}  (${cldFail} failed)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
