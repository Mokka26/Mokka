// Gerichte fix: table-lamp groep heeft producten van verschillende modellen
// (ql10620 + gh-art1015) door elkaar. Beide solo zetten + verdere members
// die zelfde issue hebben in een gerichte revisie.

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  const members = await prisma.product.findMany({
    where: { colorGroup: "table-lamp", deletedAt: null },
    select: { id: true, slug: true, colorName: true },
  });

  console.log(`\nHuidige "table-lamp" groep heeft ${members.length} leden:\n`);
  for (const m of members) {
    console.log(`  ${m.colorName?.padEnd(10) ?? "?".padEnd(10)} ${m.slug}`);
  }

  // Strategie: zet ALLE leden van "table-lamp" naar solo (null).
  // De groep is te generiek — niet één echte productlijn.
  console.log(`\n${APPLY ? "APPLY:" : "Dry-run:"} alle ${members.length} leden naar solo (colorGroup=null)`);

  if (!APPLY) {
    console.log("Run met --apply om uit te voeren.");
    process.exit(0);
  }

  let ok = 0;
  for (const m of members) {
    await prisma.product.update({ where: { id: m.id }, data: { colorGroup: null } });
    console.log(`  ✓ ${m.slug}`);
    ok++;
  }
  console.log(`\n✓ ${ok}/${members.length} klaar.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
