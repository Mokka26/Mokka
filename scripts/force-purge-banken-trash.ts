// Force-purge alle banken-producten in de prullenbak NU (skip 30d retentie).
// Replica van /api/cron/purge-trash maar:
//   - GEEN cutoff-check (purge ongeacht hoe recent soft-deleted)
//   - Scope: ALLEEN category="banken" met deletedAt != null
//
// Veilig: andere user-prullenbak-items (hoekbanken etc.) blijven.
//
// Run:
//   npx tsx scripts/force-purge-banken-trash.ts          # dry-run
//   npx tsx scripts/force-purge-banken-trash.ts --apply  # destroy

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";
import { extractPublicId } from "@/lib/cloudinary-helpers";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log("\n═══ Force-purge banken-prullenbak ═══");
  console.log(APPLY ? "MODE: APPLY (destroy + hard-delete)\n" : "MODE: dry-run\n");

  const targets = await prisma.product.findMany({
    where: { category: "banken", deletedAt: { not: null } },
    select: { id: true, slug: true, images: true },
    orderBy: { slug: "asc" },
  });

  console.log(`${targets.length} banken in prullenbak gevonden.`);

  // Tel publicIds
  const allPids: string[] = [];
  for (const p of targets) {
    try {
      const raw = JSON.parse(p.images);
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const url = typeof item === "string" ? item : item?.url;
          const pid = url ? extractPublicId(url) : null;
          if (pid) allPids.push(pid);
        }
      }
    } catch {
      // skip
    }
  }
  console.log(`Te destroyen Cloudinary-assets: ${allPids.length}\n`);

  if (!APPLY) {
    console.log("Eerste 10 publicIds preview:");
    for (const p of allPids.slice(0, 10)) console.log(`  - ${p}`);
    if (allPids.length > 10) console.log(`  ... en ${allPids.length - 10} meer\n`);
    console.log("Dry-run — geen mutaties. Run met --apply om uit te voeren.");
    process.exit(0);
  }

  let destroyed = 0;
  let failed = 0;
  let productsDeleted = 0;

  for (const p of targets) {
    let raw: unknown;
    try {
      raw = JSON.parse(p.images);
    } catch {
      raw = [];
    }
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const url = typeof item === "string" ? item : (item as { url?: string })?.url;
        const pid = url ? extractPublicId(url) : null;
        if (!pid) continue;
        try {
          await cloudinary.uploader.destroy(pid, { invalidate: true });
          destroyed++;
        } catch {
          failed++;
        }
        // Korte pauze tegen rate-limit
        await new Promise((r) => setTimeout(r, 30));
      }
    }
    try {
      await prisma.product.delete({ where: { id: p.id } });
      productsDeleted++;
      console.log(`  ✓ ${p.slug}`);
    } catch (err) {
      console.log(`  ✗ ${p.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n─── Klaar ───`);
  console.log(`  Producten hard-deleted:   ${productsDeleted}/${targets.length}`);
  console.log(`  Cloudinary destroyed:     ${destroyed}`);
  console.log(`  Cloudinary failures:      ${failed}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
