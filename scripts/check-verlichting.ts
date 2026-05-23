// Specifieke verlichting-check: groepen, solo's, mogelijke missers
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

async function main() {
  const products = await prisma.product.findMany({
    where: { category: "verlichting", deletedAt: null },
    select: {
      slug: true, name: true, colorGroup: true,
      colorName: true, colorHex: true, hidden: true,
    },
    orderBy: { slug: "asc" },
  });

  console.log(`\n═══ Verlichting: ${products.length} producten ═══\n`);

  // Per colorGroup
  const groups = new Map<string, typeof products>();
  const solo: typeof products = [];
  for (const p of products) {
    if (p.colorGroup) {
      const arr = groups.get(p.colorGroup) ?? [];
      arr.push(p);
      groups.set(p.colorGroup, arr);
    } else {
      solo.push(p);
    }
  }

  console.log(`Gegroepeerd: ${products.length - solo.length} in ${groups.size} groepen`);
  console.log(`Solo (geen colorGroup): ${solo.length}\n`);

  console.log("─── Groepen (>1 product) ───");
  const sortedGroups = Array.from(groups.entries())
    .filter(([, arr]) => arr.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [g, arr] of sortedGroups) {
    console.log(`\n  ${g}  (${arr.length}× varianten)`);
    for (const p of arr) {
      const color = p.colorName ?? "?";
      console.log(`    ${color.padEnd(10)} ${p.slug}`);
    }
  }

  // Solo-producten met kleur in slug — potentieel "vergeten" varianten
  console.log("\n─── Solo's met kleur in slug (top 30) ───");
  const colorTokens = /-?(black|white|gold|silver|brown|grey|gray|cream|red|green|blue|zwart|wit|goud|zilver|bruin|grijs|cremeer|creme|brons|koper|antraciet|champagne)/i;
  const soloWithColor = solo.filter((p) => colorTokens.test(p.slug));
  console.log(`${soloWithColor.length} solo's met kleur-token in slug:\n`);
  for (const p of soloWithColor.slice(0, 30)) {
    console.log(`  ${p.slug}`);
  }
  if (soloWithColor.length > 30) console.log(`  ... en ${soloWithColor.length - 30} meer`);

  // Solo's met EXACT zelfde basisnaam (zonder model-code), mogelijk dezelfde
  // productlijn met andere variant
  const byBasename = new Map<string, typeof products>();
  for (const p of solo) {
    const base = p.name.replace(colorTokens, "").trim().toLowerCase();
    const arr = byBasename.get(base) ?? [];
    arr.push(p);
    byBasename.set(base, arr);
  }
  const baseDupes = Array.from(byBasename.entries()).filter(([, arr]) => arr.length > 1);
  console.log(`\n─── Solo-producten met overlappende basisnaam (mogelijk varianten) ───`);
  console.log(`${baseDupes.length} basisnamen met >1 solo`);
  for (const [base, arr] of baseDupes.slice(0, 10)) {
    console.log(`\n  "${base}"`);
    for (const p of arr) console.log(`    ${p.slug}`);
  }
  if (baseDupes.length > 10) console.log(`\n  ... en ${baseDupes.length - 10} meer overlappende basisnamen`);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
