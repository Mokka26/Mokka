import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

const all = await prisma.$queryRaw<Array<{
  id: string; slug: string; name: string; description: string;
  price: number; category: string; images: string; specs: string | null;
  stock: number; colorGroup: string | null; colorName: string | null;
  hidden: boolean;
}>>`SELECT id, slug, name, description, price, category, images, specs, stock, "colorGroup", "colorName", hidden FROM "Product"`;

const visible = all.filter((p) => !p.hidden);
console.log(`=== TOTAAL ===`);
console.log(`  ${all.length} producten in DB`);
console.log(`  ${visible.length} zichtbaar`);
console.log(`  ${all.length - visible.length} hidden`);

// Per categorie
const perCat = new Map<string, { total: number; visible: number }>();
for (const p of all) {
  const cur = perCat.get(p.category) ?? { total: 0, visible: 0 };
  cur.total++;
  if (!p.hidden) cur.visible++;
  perCat.set(p.category, cur);
}
console.log(`\n=== PER CATEGORIE ===`);
for (const [cat, n] of Array.from(perCat.entries()).sort()) {
  console.log(`  ${cat.padEnd(20)} zichtbaar: ${String(n.visible).padStart(3)} / totaal ${n.total}`);
}

// Issues
const issues = {
  placeholderPrice: visible.filter((p) => p.price === 1499).length,
  shortDesc: visible.filter((p) => !p.description || p.description.length < 50).length,
  minimalSpecs: visible.filter((p) => {
    try { return Object.keys(JSON.parse(p.specs ?? "{}")).length < 3; }
    catch { return true; }
  }).length,
  emptyImages: visible.filter((p) => {
    try {
      const imgs = JSON.parse(p.images);
      return !Array.isArray(imgs) || imgs.length === 0;
    } catch { return true; }
  }).length,
  singleImage: visible.filter((p) => {
    try {
      const imgs = JSON.parse(p.images);
      return Array.isArray(imgs) && imgs.length === 1;
    } catch { return false; }
  }).length,
  noColorGroup: visible.filter((p) => !p.colorGroup).length,
  zeroStock: visible.filter((p) => p.stock === 0).length,
};
console.log(`\n=== KWALITEIT-ISSUES (zichtbare producten) ===`);
console.log(`  Placeholder prijs €1499:    ${issues.placeholderPrice}`);
console.log(`  Korte beschrijving (<50ch): ${issues.shortDesc}`);
console.log(`  Minimale specs (<3 keys):   ${issues.minimalSpecs}`);
console.log(`  Lege image array:           ${issues.emptyImages}`);
console.log(`  Enkele foto (single):       ${issues.singleImage}`);
console.log(`  Geen color group:           ${issues.noColorGroup} / ${visible.length}`);
console.log(`  Stock = 0 (uitverkocht):    ${issues.zeroStock}`);

// Prijs distributie
const prices = visible.map((p) => p.price).sort((a, b) => a - b);
console.log(`\n=== PRIJS DISTRIBUTIE ===`);
console.log(`  Min: €${prices[0]}`);
console.log(`  Max: €${prices[prices.length - 1]}`);
console.log(`  Median: €${prices[Math.floor(prices.length / 2)]}`);
const priceBuckets = { under500: 0, "500-1500": 0, "1500-3000": 0, over3000: 0 };
for (const pr of prices) {
  if (pr < 500) priceBuckets.under500++;
  else if (pr < 1500) priceBuckets["500-1500"]++;
  else if (pr < 3000) priceBuckets["1500-3000"]++;
  else priceBuckets.over3000++;
}
for (const [bucket, n] of Object.entries(priceBuckets)) console.log(`  €${bucket}: ${n}`);

// Banken-specifiek
console.log(`\n=== BANKEN/HOEKBANKEN SUB-AUDIT ===`);
const banken = visible.filter((p) => ["banken","hoekbanken"].includes(p.category));
console.log(`  ${banken.length} zichtbare banken/hoekbanken`);
console.log(`    Met placeholder prijs:  ${banken.filter((p) => p.price === 1499).length}`);
console.log(`    Met generic description: ${banken.filter((p) => p.description?.includes("modulaire") || p.description?.includes("premium kwaliteit")).length}`);

await prisma.$disconnect();
