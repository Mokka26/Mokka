/**
 * Audit alle app4sales producten — verifieer categorie tegen naam-regex.
 * Toont per categorie de items, flag mismatches.
 */

import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

const RULES = [
  { re: /\bMIRROR\b|\bSPIEGEL\b|WALL DECORATION/i, category: "spiegels" },
  { re: /\bCEILING LIGHT\b|\bCHANDELIER\b|\bLAMP\b|\bPENDANT\b|\bWALL LIGHT\b|\bSCONCE\b/i, category: "verlichting" },
  { re: /\bCHAIR\b|\bSTOEL\b/i, category: "stoelen" },
  { re: /\bEXT\.?\s*DT|\bDT\b|\bDINING\b/i, category: "eettafels" },
  { re: /\bCT\b|\bCOFFEE\b|\bSALON\b/i, category: "salontafels" },
  { re: /\bET\b|\bSIDE TABLE\b|\bEND TABLE\b/i, category: "bijzettafels" },
  { re: /\bTT\b|\bTV TABLE\b|\bTV STAND\b/i, category: "tv-meubels" },
  { re: /\bBF\b|\bBUFFET\b|\bSIDEBOARD\b|\bCABINET\b/i, category: "kasten" },
];

function detect(name: string): string {
  for (const r of RULES) if (r.re.test(name)) return r.category;
  return "tafels";
}

interface Raw { code: string; name: string; }
const data: Raw[] = JSON.parse(await readFile("scripts/app4sales-products.json", "utf8"));

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const seen = new Map<string, number>();
const mismatches: Array<{ slug: string; name: string; current: string; correct: string }> = [];
const perCat = new Map<string, Array<{ slug: string; name: string }>>();

for (const p of data) {
  const base = slugify(p.name);
  const idx = seen.get(base) ?? 0;
  seen.set(base, idx + 1);
  const slug = idx === 0 ? base : `${base}-${idx}`;

  const db = await prisma.product.findUnique({ where: { slug } });
  if (!db) continue;

  const correct = detect(p.name);
  const items = perCat.get(db.category) ?? [];
  items.push({ slug, name: p.name });
  perCat.set(db.category, items);

  if (db.category !== correct) {
    mismatches.push({ slug, name: p.name, current: db.category, correct });
  }
}

console.log("\nPER CATEGORIE:");
for (const [cat, items] of Array.from(perCat.entries()).sort()) {
  console.log(`\n=== ${cat} (${items.length}) ===`);
  for (const it of items.slice(0, 8)) console.log(`  ${it.name}`);
  if (items.length > 8) console.log(`  ...+${items.length - 8} meer`);
}

if (mismatches.length > 0) {
  console.log(`\n\n=== ${mismatches.length} MISMATCHES ===`);
  for (const m of mismatches) {
    console.log(`  ${m.slug}: ${m.current} → ${m.correct}`);
    console.log(`    "${m.name}"`);
  }
} else {
  console.log("\nGeen mismatches");
}

await prisma.$disconnect();
