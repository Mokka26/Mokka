/**
 * Diepe audit van alle producten in de DB.
 * Checks:
 *   1. Counts per categorie
 *   2. Lege/ongeldige images JSON
 *   3. Image-URLs werkend (Cloudinary HEAD checks)
 *   4. Color groups: duplicaten binnen 1 groep (zelfde kleur 2×)
 *   5. Producten met €0 of >€5000 prijs (suspect)
 *   6. Korte/lege naam, missende description, lege specs
 *   7. Duplicate slugs/codes
 *   8. Producten in tafels die eigenlijk in andere categorie horen
 *   9. Producten zonder colorGroup die wel kleur in naam hebben
 *  10. Stoelen — varianten correct gegroepeerd?
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface Issue { severity: "high" | "med" | "low"; msg: string; }
const issues: Issue[] = [];
const add = (severity: Issue["severity"], msg: string) => issues.push({ severity, msg });

const all = await prisma.product.findMany({
  select: {
    id: true, slug: true, name: true, description: true, price: true,
    category: true, images: true, specs: true, stock: true,
    colorGroup: true, colorName: true, colorHex: true,
    createdAt: true,
  },
});

console.log(`Totaal: ${all.length} producten\n`);

// 1) Counts per categorie
const perCat = new Map<string, number>();
for (const p of all) perCat.set(p.category, (perCat.get(p.category) ?? 0) + 1);
console.log("=== Counts per categorie ===");
for (const [c, n] of Array.from(perCat.entries()).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.padEnd(15)} ${n}`);
}

// 2) Lege/ongeldige images JSON
console.log("\n=== Image-data validatie ===");
let imgIssues = 0;
const allImageUrls: { slug: string; url: string }[] = [];
for (const p of all) {
  let imgs: { url?: string }[] = [];
  try { imgs = JSON.parse(p.images); } catch { add("high", `${p.slug}: images JSON parse fail`); imgIssues++; continue; }
  if (!Array.isArray(imgs) || imgs.length === 0) {
    add("high", `${p.slug}: lege/geen images array`); imgIssues++; continue;
  }
  for (const i of imgs) {
    if (!i.url || !i.url.startsWith("http")) {
      add("high", `${p.slug}: invalid image url "${i.url}"`); imgIssues++;
    } else if (i.url.includes("res.cloudinary.com")) {
      allImageUrls.push({ slug: p.slug, url: i.url });
    }
  }
}
console.log(`  ${imgIssues} issues; ${allImageUrls.length} valid Cloudinary URLs`);

// 3) Steekproef Cloudinary HEAD checks (10 random URLs)
console.log("\n=== Cloudinary URL steekproef (10x HEAD) ===");
const sample = allImageUrls.sort(() => Math.random() - 0.5).slice(0, 10);
let head404 = 0;
for (const s of sample) {
  const res = await fetch(s.url, { method: "HEAD" });
  if (!res.ok) {
    console.log(`  ${s.slug}: ${res.status} ${s.url}`);
    add("high", `${s.slug}: Cloudinary ${res.status}`);
    head404++;
  }
}
console.log(`  ${head404}/10 dood`);

// 4) Color groups: duplicaten binnen 1 groep
console.log("\n=== Color groups check ===");
const cgMap = new Map<string, Array<{ slug: string; name: string; color: string | null }>>();
for (const p of all) {
  if (!p.colorGroup) continue;
  const arr = cgMap.get(p.colorGroup) ?? [];
  arr.push({ slug: p.slug, name: p.name, color: p.colorName });
  cgMap.set(p.colorGroup, arr);
}
let dupColor = 0;
let singleVariant = 0;
for (const [group, items] of cgMap) {
  if (items.length < 2) {
    add("med", `colorGroup "${group}" heeft maar 1 item: ${items[0]?.slug}`);
    singleVariant++;
    continue;
  }
  const colors = items.map((i) => i.color);
  const uniqColors = new Set(colors);
  if (uniqColors.size < colors.length) {
    console.log(`  ${group}: ${items.length} items, slechts ${uniqColors.size} unieke kleuren`);
    for (const i of items) console.log(`    ${i.slug} — ${i.color}`);
    dupColor++;
  }
}
console.log(`  ${cgMap.size} color groups, ${singleVariant} eenlingen, ${dupColor} met duplicate kleuren binnen groep`);

// 5) Prijzen
console.log("\n=== Prijs sanity ===");
let zeroPrice = 0, highPrice = 0;
for (const p of all) {
  if (p.price === 0) { add("high", `${p.slug}: prijs €0`); zeroPrice++; }
  else if (p.price > 5000) { add("low", `${p.slug}: prijs €${p.price}`); highPrice++; }
}
console.log(`  ${zeroPrice} producten met €0, ${highPrice} met >€5000`);

// 6) Naam/description/specs validatie
console.log("\n=== Naam/desc/specs ===");
let shortName = 0, noDesc = 0, noSpecs = 0;
for (const p of all) {
  if (p.name.length < 5) { add("med", `${p.slug}: korte naam "${p.name}"`); shortName++; }
  if (!p.description || p.description.length < 20) { add("low", `${p.slug}: dunne description`); noDesc++; }
  if (!p.specs || p.specs === "{}" || p.specs === "null") { add("low", `${p.slug}: geen specs`); noSpecs++; }
}
console.log(`  ${shortName} korte namen, ${noDesc} dunne descriptions, ${noSpecs} zonder specs`);

// 7) Duplicate slugs - kan niet via Prisma maar check codes via specs/name combo
console.log("\n=== Duplicate detectie ===");
const nameMap = new Map<string, string[]>();
for (const p of all) {
  const key = p.name.toLowerCase();
  const arr = nameMap.get(key) ?? [];
  arr.push(p.slug);
  nameMap.set(key, arr);
}
let dupNames = 0;
for (const [name, slugs] of nameMap) {
  if (slugs.length > 1) {
    add("med", `duplicate naam "${name}": ${slugs.join(", ")}`);
    dupNames++;
  }
}
console.log(`  ${dupNames} producten met dezelfde naam (verschillende slugs)`);

// 8) tafels die elders horen
console.log("\n=== Producten in 'tafels' die anders kunnen ===");
const tafels = all.filter((p) => p.category === "tafels");
console.log(`  ${tafels.length} totaal in 'tafels':`);
for (const p of tafels.slice(0, 10)) console.log(`    ${p.name}`);
if (tafels.length > 10) console.log(`    ...+${tafels.length - 10} meer`);

// 9) Producten zonder colorGroup maar met duidelijk kleur
console.log("\n=== Mogelijke gemiste color groups ===");
const noGroup = all.filter((p) => !p.colorGroup);
const colorKeywords = /\b(zwart|wit|bruin|grijs|beige|crème|creme|goud|brons|naturel|rood|blauw|groen|taupe|chroom|flintstone|oak|eiken|black|white|cream|brown|grey|gray)\b/i;
let mayHaveGroup = 0;
for (const p of noGroup) {
  if (colorKeywords.test(p.name)) mayHaveGroup++;
}
console.log(`  ${mayHaveGroup}/${noGroup.length} producten zonder group hebben kleur-woord in naam`);

// Samenvatting
console.log("\n=== ISSUES SAMENVATTING ===");
const bySev = { high: 0, med: 0, low: 0 };
for (const i of issues) bySev[i.severity]++;
console.log(`  HIGH: ${bySev.high}`);
console.log(`  MED:  ${bySev.med}`);
console.log(`  LOW:  ${bySev.low}`);

console.log("\nHIGH issues (eerste 10):");
issues.filter((i) => i.severity === "high").slice(0, 10).forEach((i) => console.log(`  ${i.msg}`));

console.log("\nMED issues (eerste 10):");
issues.filter((i) => i.severity === "med").slice(0, 10).forEach((i) => console.log(`  ${i.msg}`));

await prisma.$disconnect();
