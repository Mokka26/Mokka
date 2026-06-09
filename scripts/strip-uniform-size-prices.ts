// Maakt maat-prijzen leeg (label-only) op bedden waar alle maten dezelfde
// prijs hebben — dat zijn de bulk-geseede placeholders, geen echte per-maat
// prijzen. Daardoor valt de maat terug op de product-Verkoopprijs/Adviesprijs.
// Bedden met ÉCHT verschillende maat-prijzen blijven ongemoeid.
//
// Dry-run:  npx tsx scripts/strip-uniform-size-prices.ts
// Apply:    npx tsx scripts/strip-uniform-size-prices.ts --apply
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type V = { label: string; price?: number; listPrice?: number };

async function main() {
  const beds = await p.product.findMany({
    where: { category: "bedden", deletedAt: null, NOT: { sizeVariants: null } },
    select: { id: true, slug: true, sizeVariants: true },
  });
  let stripped = 0, keptDiffering = 0;
  for (const b of beds) {
    let arr: V[] = [];
    try { arr = JSON.parse(b.sizeVariants || "[]"); } catch { continue; }
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const prices = arr.map((v) => v.price).filter((x): x is number => typeof x === "number");
    const uniform = prices.length <= 1 || prices.every((x) => x === prices[0]);
    if (!uniform) { keptDiffering++; continue; }
    const labelsOnly = arr.map((v) => ({ label: v.label }));
    if (APPLY) await p.product.update({ where: { id: b.id }, data: { sizeVariants: JSON.stringify(labelsOnly) } });
    stripped++;
  }
  console.log(`Bedden met maten: ${beds.length}`);
  console.log(`→ maat-prijzen leeggemaakt (uniform/placeholder): ${stripped}`);
  console.log(`→ behouden (echt verschillende maat-prijzen): ${keptDiffering}`);
  console.log(APPLY ? "\n✅ Toegepast." : "\n(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
