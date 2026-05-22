// Soft-delete alle 37 hidden producten in legacy DB-categorie "banken".
// De /banken-route blijft werken (umbrella over hoekbanken + bankstellen).
// Foto's worden door purge-trash cron na 30d uit Cloudinary verwijderd.
//
// Run:
//   npx tsx scripts/soft-delete-legacy-banken.ts          # dry-run
//   npx tsx scripts/soft-delete-legacy-banken.ts --apply  # uitvoeren

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

const APPLY = process.argv.includes("--apply");

async function main() {
  const targets = await prisma.product.findMany({
    where: { category: "banken", hidden: true, deletedAt: null },
    select: { id: true, slug: true, name: true, images: true },
    orderBy: { name: "asc" },
  });

  console.log(`\n═══ Soft-delete legacy banken (${targets.length} producten) ═══`);
  console.log(APPLY ? "MODE: APPLY (echte mutatie)\n" : "MODE: dry-run (use --apply om uit te voeren)\n");

  let totalImgs = 0;
  for (const p of targets) {
    const n = parseImages(p.images).length;
    totalImgs += n;
    console.log(`  ${n.toString().padStart(2)} foto's  ${p.slug.padEnd(28)} ${p.name}`);
  }
  console.log(`\nTotaal: ${targets.length} producten, ${totalImgs} foto's vrij na 30d cron-purge.`);

  if (!APPLY) {
    console.log("\nDry-run — geen mutaties. Run met --apply om uit te voeren.");
    process.exit(0);
  }

  console.log("\nSoft-deleting...");
  const now = new Date();
  let ok = 0;
  for (const p of targets) {
    try {
      await prisma.product.update({ where: { id: p.id }, data: { deletedAt: now } });
      console.log(`  ✓ ${p.slug}`);
      ok++;
    } catch (err) {
      console.log(`  ✗ ${p.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n✓ ${ok}/${targets.length} soft-deleted. Zichtbaar in /admin/trash tot cron-purge over 30d.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
