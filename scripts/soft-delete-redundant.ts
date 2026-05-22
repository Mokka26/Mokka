// Soft-delete 8 producten die als duplicaat of testdata zijn geïdentificeerd.
// Zet alleen deletedAt — purge-trash cron ruimt Cloudinary na 30d.
//
// Run:
//   npx tsx scripts/soft-delete-redundant.ts          # dry-run
//   npx tsx scripts/soft-delete-redundant.ts --apply  # uitvoeren

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

const SLUGS_TO_DELETE = [
  // Duplicaten van zichtbare producten
  "amerivano-bank",
  "cloud-bank-p10",
  "clara-bank-p34",
  // 2 van 3 Pachino's (pachino-bank blijft als enige verborgen Pachino)
  "pachinho-bank",
  "pachino-bank-p42",
  // Testdata
  "ares-l2e-bank",
  "cloud-abramo3-bank",
  "yola-bank",
];

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`\n═══ Soft-delete ${SLUGS_TO_DELETE.length} redundante producten ═══`);
  console.log(APPLY ? "MODE: APPLY (echte mutatie)\n" : "MODE: dry-run (use --apply om uit te voeren)\n");

  // Bevestig dat alle slugs bestaan + nog niet ge-deleted zijn
  const found = await prisma.product.findMany({
    where: { slug: { in: SLUGS_TO_DELETE } },
    select: { id: true, slug: true, name: true, images: true, deletedAt: true, hidden: true },
  });

  const foundSlugs = new Set(found.map((p) => p.slug));
  const missing = SLUGS_TO_DELETE.filter((s) => !foundSlugs.has(s));
  if (missing.length > 0) {
    console.log("⚠ Niet gevonden:");
    for (const s of missing) console.log(`  - ${s}`);
  }

  const alreadyDeleted = found.filter((p) => p.deletedAt);
  if (alreadyDeleted.length > 0) {
    console.log("⚠ Al soft-deleted (skip):");
    for (const p of alreadyDeleted) console.log(`  - ${p.slug}`);
  }

  const toProcess = found.filter((p) => !p.deletedAt);
  console.log(`\n${toProcess.length} producten te verwerken:`);
  let totalImgs = 0;
  for (const p of toProcess) {
    const n = parseImages(p.images).length;
    totalImgs += n;
    console.log(`  ${n.toString().padStart(2)} foto's  ${p.slug.padEnd(28)} ${p.name}`);
  }
  console.log(`\nTotaal foto's vrij na 30d cron-purge: ${totalImgs}`);

  if (!APPLY) {
    console.log("\nDry-run — geen mutaties. Run met --apply om uit te voeren.");
    process.exit(0);
  }

  console.log("\nSoft-deleting...");
  let ok = 0;
  for (const p of toProcess) {
    try {
      await prisma.product.update({
        where: { id: p.id },
        data: { deletedAt: new Date() },
      });
      console.log(`  ✓ ${p.slug}`);
      ok++;
    } catch (err) {
      console.log(`  ✗ ${p.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n✓ ${ok}/${toProcess.length} soft-deleted. Zichtbaar in /admin/trash totdat cron ze definitief verwijdert (30d).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
