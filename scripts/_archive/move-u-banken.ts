// Verplaats U-Banken naar hoekbanken-categorie (U-vorm = corner).
// Run:
//   npx tsx scripts/move-u-banken.ts                # dry-run
//   npx tsx scripts/move-u-banken.ts --apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  const ubs = await prisma.product.findMany({
    where: {
      category: "banken",
      OR: [
        { slug: { contains: "-u-bank" } },
        { slug: { endsWith: "-ubank" } },
      ],
      deletedAt: null,
    },
    select: { id: true, slug: true, name: true },
  });

  console.log(`\nU-Banken om te verplaatsen naar hoekbanken (${ubs.length}):`);
  for (const u of ubs) console.log(`  ${u.slug.padEnd(40)} ${u.name}`);

  if (!APPLY) { console.log(`\n[DRY-RUN]`); return; }

  await prisma.$transaction(
    ubs.map((u) => prisma.product.update({ where: { id: u.id }, data: { category: "hoekbanken" } })),
  );
  console.log(`\n✓ ${ubs.length} U-Banken naar hoekbanken-categorie verplaatst.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
