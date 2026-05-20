// Herstructureer per user-wens:
//   1. Re-hide de 46 verkeerd-restored banken/hoekbanken (NIET uit folders)
//   2. Verplaats alle 32 folder-banken naar 'hoekbanken' category
//   3. Resultaat: banken=0, hoekbanken=32, bankstellen=35
//      alle-banken (umbrella) = hoekbanken + bankstellen = 67

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

// De 32 producten uit de 3 wetransfer-folders
const FOLDER_SLUGS = new Set([
  // wetransfer_banken/banken/ → 12 single banken
  "americano-bank", "anna-bank", "ares-bank", "ares-u-bank", "bella-bank",
  "clara-bank", "cloud-bank", "coast-lux-bank", "finn-bank", "moana-bank",
  "mystic-bank", "new-bolton-bank",
  // wetransfer_finn/ → 6
  "jolly-kemer-hoekbank", "yola-monolith-hoekbank",
  "california-magic-loungebank", "star-croco-loungebank", "star-preston-c-loungebank",
  "new-bolton-fresh-u-bank",
  // wetransfer_hoekbank/ → 13
  "bolton-riviera-hoekbank", "california-kemer-hoekbank", "california-magic-hoekbank",
  "fortes-kemer-hoekbank", "mila-monolith-hoekbank", "new-bolton-kronos-hoekbank",
  "new-bolton-riviera-hoekbank", "rafaello-relax-decowit-hoekbank",
  "rosso-soro-hoekbank", "star-kemer-hoekbank",
  "bonna-monolith-loungebank", "rosso-soro-loungebank",
  "kingstone-genova-texarm-u-bank",
  // anna-hoekbank: kreeg foto's uit anna folder via split
  "anna-hoekbank",
]);

async function main() {
  console.log(`\n═══ Herstructureer naar 2 categorieën ═══`);
  console.log(`  Apply: ${APPLY ? "YES" : "no (dry-run)"}\n`);

  // 1. Visible banken/hoekbanken producten die NIET in folders zitten → hide
  const visible = await prisma.product.findMany({
    where: {
      category: { in: ["banken", "hoekbanken"] },
      hidden: false,
      deletedAt: null,
    },
    select: { id: true, slug: true, name: true, category: true },
  });

  const toHide = visible.filter((p) => !FOLDER_SLUGS.has(p.slug));
  const folderVisible = visible.filter((p) => FOLDER_SLUGS.has(p.slug));

  console.log(`Visible nu: ${visible.length}`);
  console.log(`  → uit folders (keep): ${folderVisible.length}`);
  console.log(`  → niet uit folders (hide): ${toHide.length}\n`);

  // 2. Folder-banken die nog in 'banken' cat staan → verplaats naar 'hoekbanken'
  const toMove = folderVisible.filter((p) => p.category === "banken");
  console.log(`Verplaatsen naar 'hoekbanken' category: ${toMove.length}\n`);
  for (const p of toMove) console.log(`  ${p.slug.padEnd(40)} ${p.name}`);

  console.log(`\nTe hiden (niet uit folders): ${toHide.length}`);
  for (const p of toHide) console.log(`  [cat=${p.category.padEnd(12)}] ${p.slug.padEnd(40)} ${p.name}`);

  if (!APPLY) { console.log(`\n[DRY-RUN]`); return; }

  await prisma.$transaction([
    ...toHide.map((p) => prisma.product.update({ where: { id: p.id }, data: { hidden: true } })),
    ...toMove.map((p) => prisma.product.update({ where: { id: p.id }, data: { category: "hoekbanken" } })),
  ]);

  console.log(`\n✓ ${toHide.length} verkeerd-zichtbaar gehide`);
  console.log(`✓ ${toMove.length} verplaatst naar hoekbanken`);
  console.log(`✓ Eindstand: banken=0, hoekbanken=32, bankstellen=35`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
