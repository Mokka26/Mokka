/**
 * Herclassificeer de 61 producten in 'tafels' fallback naar specifieke
 * subcategorieën met verbeterde regex + parent-edition info.
 */

import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface RawProduct {
  code: string; name: string; parentEdition?: string;
  catalogEdition: string;
}

const rawData: RawProduct[] = JSON.parse(await readFile("scripts/app4sales-products.json", "utf8"));

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const seen = new Map<string, number>();
const slugToRaw = new Map<string, RawProduct>();
for (const p of rawData) {
  const base = slugify(p.name);
  const idx = seen.get(base) ?? 0;
  seen.set(base, idx + 1);
  const slug = idx === 0 ? base : `${base}-${idx}`;
  slugToRaw.set(slug, p);
}

// Verbeterde regels — meest specifiek eerst
function detectCategory(raw: RawProduct): string {
  const n = raw.name.toUpperCase();

  // Parent-edition override eerst (zeer betrouwbaar)
  if (raw.parentEdition === "51") return "stoelen";
  if (raw.parentEdition === "56") return "verlichting";
  if (raw.parentEdition === "75") return "kasten"; // W.CABINETS

  if (/\bMIRROR\b|WALL DECORATION/.test(n)) return "spiegels";
  if (/\bCEILING LIGHT\b|\bCHANDELIER\b|\bLAMP\b|\bPENDANT\b|\bWALL LIGHT\b|\bSCONCE\b|FLOOR LAMP|TABLE LAMP/.test(n)) return "verlichting";
  if (/\bCHAIR\b/.test(n)) return "stoelen";
  if (/HANGING\s*TV|\bTV TABLE\b|\bTV STAND\b|\bTT\b/.test(n)) return "tv-meubels";
  if (/\bEXT\.?\s*DT\b|\bDT\b|\bDINING\b|\bDINNING\b/.test(n)) return "eettafels";
  if (/\bCT\d?\b|\bCOFFEE\b/.test(n)) return "salontafels";
  if (/\bET\b|\bSIDE TABLE\b|\bEND TABLE\b/.test(n)) return "bijzettafels";
  if (/\bBF\b|\bW\.?\s*CABINET\b|\bCABINET\b|\bBUFFET\b|\bSIDEBOARD\b|BOOK RACK/.test(n)) return "kasten";

  // Laatste vangnet: SMART TABLE / SINTER STONE / accessoires
  if (/SMART TABLE/.test(n)) return "eettafels";
  if (/TABLE TOP|STONE TOP|MARBLE TOP\b|LEG (BLACK|WHITE) FOR TABLES/.test(n)) return "tafel-accessoires";

  return "tafels"; // echt onbekend
}

async function main() {
  const tafels = await prisma.product.findMany({
    where: { category: "tafels", slug: { in: Array.from(slugToRaw.keys()) } },
    select: { id: true, slug: true, name: true },
  });

  console.log(`${tafels.length} producten in 'tafels' fallback\n`);

  const moves: Map<string, Array<{ slug: string; name: string }>> = new Map();
  for (const t of tafels) {
    const raw = slugToRaw.get(t.slug);
    if (!raw) continue;
    const newCat = detectCategory(raw);
    if (newCat === "tafels") continue;
    const arr = moves.get(newCat) ?? [];
    arr.push({ slug: t.slug, name: t.name });
    moves.set(newCat, arr);
  }

  console.log("=== VERPLAATSINGEN ===");
  for (const [cat, items] of moves) {
    console.log(`\n→ ${cat} (${items.length}):`);
    for (const i of items.slice(0, 12)) console.log(`    ${i.name}`);
    if (items.length > 12) console.log(`    ...+${items.length - 12} meer`);
  }

  console.log("\nUitvoeren...");
  let moved = 0;
  for (const [cat, items] of moves) {
    for (const i of items) {
      const dbItem = tafels.find((t) => t.slug === i.slug)!;
      // Update ook specs.Categorie als specs JSON bestaat
      const dbFull = await prisma.product.findUnique({ where: { id: dbItem.id }, select: { specs: true } });
      let specs: Record<string, string> = {};
      try { specs = JSON.parse(dbFull?.specs ?? "{}"); } catch {}
      specs.Categorie = cat === "tafel-accessoires" ? "Tafelblad/Accessoire" :
        cat === "tv-meubels" ? "TV-meubel" :
        cat === "eettafels" ? "Eettafel" :
        cat === "salontafels" ? "Salontafel" :
        cat === "bijzettafels" ? "Bijzettafel" :
        cat === "kasten" ? "Dressoir" :
        cat === "stoelen" ? "Eetkamerstoel" :
        cat === "verlichting" ? "Lamp" :
        cat === "spiegels" ? "Spiegel" : specs.Categorie;
      await prisma.product.update({
        where: { id: dbItem.id },
        data: { category: cat, specs: JSON.stringify(specs) },
      });
      moved++;
    }
  }
  console.log(`${moved} producten verplaatst`);

  // Eindstand
  const final = await prisma.product.findMany({ select: { category: true } });
  const counts = new Map<string, number>();
  for (const p of final) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  console.log("\n=== EINDSTAND ===");
  for (const [c, n] of Array.from(counts.entries()).sort()) console.log(`  ${c.padEnd(20)} ${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
