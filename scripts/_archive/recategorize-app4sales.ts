/**
 * Re-categorize alleen daadwerkelijke app4sales producten op basis van het JSON-bestand.
 * Match op product code (uniek voor app4sales).
 */

import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface RawProduct { code: string; name: string; }

const RULES = [
  { re: /\bMIRROR\b|\bSPIEGEL\b|WALL DECORATION/i, category: "spiegels", subType: "Spiegel/Wandaccessoire" },
  { re: /\bCEILING LIGHT\b|\bCHANDELIER\b|\bLAMP\b|\bPENDANT\b|\bWALL LIGHT\b|\bSCONCE\b/i, category: "verlichting", subType: "Lamp" },
  { re: /\bCHAIR\b|\bSTOEL\b/i, category: "stoelen", subType: "Eetkamerstoel" },
  { re: /\bEXT\.?\s*DT|\bDT\b|\bDINING\b/i, category: "eettafels", subType: "Eettafel" },
  { re: /\bCT\b|\bCOFFEE\b|\bSALON\b/i, category: "salontafels", subType: "Salontafel" },
  { re: /\bET\b|\bSIDE TABLE\b|\bEND TABLE\b/i, category: "bijzettafels", subType: "Bijzettafel" },
  { re: /\bTT\b|\bTV TABLE\b|\bTV STAND\b/i, category: "tv-meubels", subType: "TV-meubel" },
  { re: /\bBF\b|\bBUFFET\b|\bSIDEBOARD\b|\bCABINET\b/i, category: "kasten", subType: "Dressoir" },
];

function detectCategory(name: string): { category: string; subType: string } {
  for (const r of RULES) if (r.re.test(name)) return { category: r.category, subType: r.subType };
  return { category: "tafels", subType: "Tafel" };
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function main() {
  // Eerst: herstel de 5 verkeerd verplaatste banken
  const restored = await prisma.product.updateMany({
    where: {
      slug: { in: ["olivia-bank", "monza-bankstel-cr-me", "monza-bankstel-bruin", "kingstone-bank", "bolivia-bank"] },
      category: "tafels",
    },
    data: { category: "banken" },
  });
  console.log(`${restored.count} banken hersteld naar 'banken' categorie`);

  // Daarna: re-categorize alleen app4sales producten (uniek match op slug-uit-naam)
  const data: RawProduct[] = JSON.parse(await readFile("scripts/app4sales-products.json", "utf8"));

  // Build slug-to-name mapping van app4sales JSON (met dedupe-suffix)
  const seenSlugs = new Map<string, number>();
  const targetSlugs = new Map<string, RawProduct>();
  for (const p of data) {
    const base = slugify(p.name);
    const idx = seenSlugs.get(base) ?? 0;
    seenSlugs.set(base, idx + 1);
    const slug = idx === 0 ? base : `${base}-${idx}`;
    targetSlugs.set(slug, p);
  }

  console.log(`\nCheck ${targetSlugs.size} app4sales-slugs...`);
  let fixed = 0;
  for (const [slug, p] of targetSlugs) {
    const dbProduct = await prisma.product.findUnique({ where: { slug } });
    if (!dbProduct) continue;
    const correct = detectCategory(p.name);
    if (dbProduct.category !== correct.category) {
      console.log(`  ${slug.padEnd(60)} ${dbProduct.category} → ${correct.category}`);
      let specs: Record<string, string> = {};
      try { specs = JSON.parse(dbProduct.specs ?? "{}"); } catch {}
      specs.Categorie = correct.subType;
      await prisma.product.update({
        where: { id: dbProduct.id },
        data: { category: correct.category, specs: JSON.stringify(specs) },
      });
      fixed++;
    }
  }
  console.log(`\n${fixed} app4sales producten hergecategoriseerd`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
