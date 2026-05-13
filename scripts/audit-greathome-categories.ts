/**
 * Diepe categorie-audit voor app4sales/GreatHome producten.
 * Per categorie: lijst alle producten en flag mismatches op basis van naam-patroon.
 */

import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface RawProduct { code: string; name: string; }
const rawData: RawProduct[] = JSON.parse(await readFile("scripts/app4sales-products.json", "utf8"));

// Bouw slug → raw name map (zelfde dedupe-logica)
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
const seen = new Map<string, number>();
const slugToRaw = new Map<string, string>();
for (const p of rawData) {
  const base = slugify(p.name);
  const idx = seen.get(base) ?? 0;
  seen.set(base, idx + 1);
  const slug = idx === 0 ? base : `${base}-${idx}`;
  slugToRaw.set(slug, p.name);
}

// Per-categorie expected patterns
interface CatCheck {
  cat: string;
  expectedKeywords: RegExp;
  rejectKeywords?: RegExp;
}

const checks: CatCheck[] = [
  { cat: "eettafels", expectedKeywords: /\bDT\b|\bDINING\b|\bDINNING\b|\bEXT\.?\s*DT|SMART TABLE/i, rejectKeywords: /\bCT\d?\b|\bET\b|\bTT\b|\bBF\b|\bLAMP\b|\bMIRROR\b|\bCHAIR\b|\bWALL DEC/i },
  { cat: "salontafels", expectedKeywords: /\bCT\d?\b|\bCOFFEE\b/i, rejectKeywords: /\bDT\b|\bET\b|\bTT\b|\bBF\b|\bLAMP\b|\bMIRROR\b|\bCHAIR\b/i },
  { cat: "bijzettafels", expectedKeywords: /\bET\b|\bSIDE TABLE\b/i, rejectKeywords: /\bDT\b|\bCT\d?\b|\bTT\b|\bBF\b|\bLAMP\b|\bMIRROR\b/i },
  { cat: "tv-meubels", expectedKeywords: /\bTT\b|\bTV\b|HANGING TV/i, rejectKeywords: /\bDT\b|\bCT\d?\b|\bET\b|\bBF\b|\bLAMP\b|\bMIRROR\b/i },
  { cat: "kasten", expectedKeywords: /\bBF\b|\bW\.?\s*CABINET\b|\bCABINET\b|\bBUFFET\b|\bSIDEBOARD\b|BOOK RACK/i },
  // Stoelen: CHAIR OF parent=51 (chairs index)
  { cat: "stoelen", expectedKeywords: /\bCHAIR\b|\bZB-\d+|\bDC-\d+|\bMC-\d+/i },
  { cat: "spiegels", expectedKeywords: /\bMIRROR\b|WALL DECORATION/i },
  { cat: "verlichting", expectedKeywords: /\bLAMP\b|\bLIGHT\b|\bCHANDELIER\b|\bPENDANT\b|\bSCONCE\b|Onbekend/i },
];

for (const check of checks) {
  const products = await prisma.product.findMany({
    where: { category: check.cat, slug: { in: Array.from(slugToRaw.keys()) } },
    select: { slug: true, name: true },
  });
  console.log(`\n=== ${check.cat.toUpperCase()} (${products.length} app4sales producten) ===`);

  const suspicious: Array<{ slug: string; name: string; rawName: string; reason: string }> = [];
  for (const p of products) {
    const raw = slugToRaw.get(p.slug) ?? p.name;
    const matches = check.expectedKeywords.test(raw);
    const rejected = check.rejectKeywords?.test(raw) ?? false;
    if (!matches || rejected) {
      let reason = "";
      if (!matches) reason = "geen expected keyword";
      if (rejected) reason += (reason ? " + " : "") + "match reject keyword";
      suspicious.push({ slug: p.slug, name: p.name, rawName: raw, reason });
    }
  }

  if (suspicious.length === 0) {
    console.log(`  ✓ alle ${products.length} kloppen met patroon`);
  } else {
    console.log(`  ⚠ ${suspicious.length}/${products.length} suspect:`);
    for (const s of suspicious.slice(0, 30)) {
      console.log(`    [${s.reason}]`);
      console.log(`      naam: "${s.name}"`);
      console.log(`      bron: "${s.rawName}"`);
    }
    if (suspicious.length > 30) console.log(`    ...+${suspicious.length - 30} meer`);
  }
}

// Bonus: alle tafels (de fallback-bucket)
const tafels = await prisma.product.findMany({
  where: { category: "tafels", slug: { in: Array.from(slugToRaw.keys()) } },
  select: { slug: true, name: true },
});
console.log(`\n=== TAFELS (fallback, ${tafels.length}) ===`);
for (const t of tafels) {
  const raw = slugToRaw.get(t.slug) ?? t.name;
  console.log(`  ${t.slug}`);
  console.log(`    naam: "${t.name}"  bron: "${raw}"`);
}

await prisma.$disconnect();
