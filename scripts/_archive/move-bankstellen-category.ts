// Verplaats alle bankstel-producten van "banken" naar "bankstellen" categorie
// + hide 2 placeholder banken die niet uit de folders komen.
//
// Run:
//   npx tsx scripts/move-bankstellen-category.ts             # dry-run
//   npx tsx scripts/move-bankstellen-category.ts --apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const PLACEHOLDER_HIDE = ["ares-l2e-bank", "cloud-abramo3-bank"];

async function main() {
  console.log(`\n═══ Verplaats bankstellen + hide placeholders ═══`);
  console.log(`  Apply: ${APPLY ? "YES" : "no (dry-run)"}\n`);

  // Bankstellen: slug bevat "-bankstel" en categorie is "banken"
  const bankstellen = await prisma.product.findMany({
    where: {
      category: "banken",
      slug: { contains: "-bankstel" },
      deletedAt: null,
    },
    select: { id: true, slug: true, name: true },
  });

  console.log(`Bankstellen om te verplaatsen (${bankstellen.length}):`);
  for (const b of bankstellen) console.log(`  ${b.slug.padEnd(35)} ${b.name}`);

  const placeholders = await prisma.product.findMany({
    where: { slug: { in: PLACEHOLDER_HIDE } },
    select: { id: true, slug: true, hidden: true },
  });
  const toHide = placeholders.filter((p) => !p.hidden);
  console.log(`\nPlaceholders om te hiden (${toHide.length}):`);
  for (const p of toHide) console.log(`  ${p.slug}`);

  if (!APPLY) { console.log(`\n[DRY-RUN]`); return; }

  await prisma.$transaction([
    ...bankstellen.map((b) =>
      prisma.product.update({
        where: { id: b.id },
        data: { category: "bankstellen" },
      }),
    ),
    ...toHide.map((p) =>
      prisma.product.update({
        where: { id: p.id },
        data: { hidden: true },
      }),
    ),
  ]);

  console.log(`\n✓ ${bankstellen.length} bankstellen verplaatst naar 'bankstellen' categorie`);
  console.log(`✓ ${toHide.length} placeholders hidden`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
