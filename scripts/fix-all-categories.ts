// Fix descriptions + materiaal over alle categorieën (behalve verlichting,
// al gedaan, en bedden-descriptions, al uniek).
//
//   1. Description: vervang boilerplate ("Premium kwaliteit met duurzame
//      materialen") + placeholder ("Tijdelijk product") met factual template
//      uit bestaande specs. Skip producten zonder bruikbare specs.
//   2. Materiaal: ALLEEN uit slug-detectie (veilig), geen blind-default.
//
// Run:
//   npx tsx scripts/fix-all-categories.ts          # dry-run
//   npx tsx scripts/fix-all-categories.ts --apply  # apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

interface Specs {
  Categorie?: string; Serie?: string; Afmetingen?: string;
  Materiaal?: string; Kleur?: string; Afwerking?: string;
  Patroon?: string; Levertijd?: string; Vermogen?: string;
  [k: string]: string | undefined;
}

function parseSpecs(s: string | null): Specs {
  if (!s) return {};
  try { const o = JSON.parse(s); return typeof o === "object" && o ? o : {}; }
  catch { return {}; }
}

// Materiaal alleen waar slug het DUIDELIJK maakt — geen gokken
function detectMateriaal(slug: string, name: string, specs: Specs): string | null {
  const txt = `${slug} ${name} ${specs.Afwerking ?? ""}`.toLowerCase();
  if (/sinter-?stone|sintersteen/.test(txt)) return "Sintersteen";
  if (/travertine|travertijn/.test(txt)) return "Travertijn";
  if (/marble|marmer/.test(txt)) return "Marmer";
  if (/veneer|fineer/.test(txt)) return "Hout (fineer)";
  if (/leather|leder|leer/.test(txt)) return "Leer";
  if (/velvet|fluweel/.test(txt)) return "Fluweel";
  if (/boucle|bouclé|bouclette/.test(txt)) return "Bouclé";
  if (/rattan|rotan/.test(txt)) return "Rattan";
  if (/\boak\b|eiken/.test(txt)) return "Eiken";
  if (/glass|glas/.test(txt)) return "Glas";
  if (/\bresin\b|hars/.test(txt)) return "Hars";
  // Geen blind-default — leeg laten als onduidelijk
  return null;
}

// Type-naam uit category + specs.Categorie
function typeName(category: string, specs: Specs): string {
  if (specs.Categorie) {
    // Pak eerste deel voor "/" (bv "Spiegel/Wandaccessoire" → "Spiegel")
    return specs.Categorie.split("/")[0].trim();
  }
  const map: Record<string, string> = {
    eettafels: "Eettafel", salontafels: "Salontafel", bijzettafels: "Bijzettafel",
    stoelen: "Stoel", spiegels: "Spiegel", kasten: "Kast",
    "tv-meubels": "Tv-meubel", tafels: "Tafel", "tafel-accessoires": "Accessoire",
    hoekbanken: "Hoekbank", bankstellen: "Bankstel",
  };
  return map[category] ?? "Product";
}

function generateDescription(p: {
  name: string; colorName: string | null; category: string; specs: Specs;
}): string {
  const { specs } = p;
  const type = typeName(p.category, specs);
  const parts: string[] = [];

  const kleur = (specs.Kleur ?? p.colorName);
  const kleurDeel = kleur && kleur !== "?" ? ` in ${kleur.toLowerCase()}` : "";
  parts.push(`${type}${kleurDeel}.`);

  if (specs.Serie && specs.Serie.toLowerCase() !== p.name.toLowerCase()) {
    const serie = specs.Serie.charAt(0).toUpperCase() + specs.Serie.slice(1).toLowerCase();
    parts.push(`Onderdeel van de ${serie}-collectie.`);
  }
  if (specs.Afmetingen) parts.push(`Afmetingen: ${specs.Afmetingen}.`);
  if (specs.Materiaal) parts.push(`Uitgevoerd in ${specs.Materiaal.toLowerCase()}.`);
  else if (specs.Afwerking) parts.push(`Afwerking: ${specs.Afwerking.toLowerCase()}.`);
  if (specs.Patroon && specs.Patroon.toLowerCase() !== "plain") parts.push(`Patroon: ${specs.Patroon.toLowerCase()}.`);
  if (specs.Levertijd) parts.push(`Levertijd: ${specs.Levertijd}.`);

  return parts.join(" ");
}

const SKIP_CATEGORIES = ["verlichting", "bedden", "matrassen", "slaapkamers"];

async function main() {
  console.log("\n═══ Fix-all categorieën (descriptions + materiaal) ═══");
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");
  console.log(`Skip categorieën: ${SKIP_CATEGORIES.join(", ")}\n`);

  const products = await prisma.product.findMany({
    where: { deletedAt: null, hidden: false, category: { notIn: SKIP_CATEGORIES } },
    select: {
      id: true, slug: true, name: true, description: true,
      specs: true, colorName: true, category: true,
    },
  });

  type Update = { id: string; slug: string; newSpecs?: string; newDesc?: string; changes: string[] };
  const updates: Update[] = [];
  const perCatCount = new Map<string, number>();

  for (const p of products) {
    const specs = parseSpecs(p.specs);
    const changes: string[] = [];
    let newSpecs: Specs | null = null;
    let newDesc: string | undefined;

    // 1. Materiaal uit slug-detectie (alleen waar leeg + detecteerbaar)
    if (!specs.Materiaal) {
      const mat = detectMateriaal(p.slug, p.name, specs);
      if (mat) {
        newSpecs = { ...specs, Materiaal: mat };
        changes.push(`+Materiaal: ${mat}`);
      }
    }

    // 2. Description regenereren waar boilerplate/placeholder + bruikbare specs
    const isBoilerplate = !!p.description && (
      /Premium kwaliteit met duurzame materialen/i.test(p.description) ||
      /Tijdelijk product/i.test(p.description)
    );
    // Alleen regenereren als we genoeg specs hebben om iets zinvols te maken
    const hasUsableSpecs = !!(specs.Afmetingen || specs.Kleur || specs.Serie || specs.Categorie);
    if (isBoilerplate && hasUsableSpecs) {
      newDesc = generateDescription({
        name: p.name, colorName: p.colorName, category: p.category,
        specs: newSpecs ?? specs,
      });
      changes.push(`~Description`);
    }

    if (changes.length > 0) {
      updates.push({
        id: p.id, slug: p.slug,
        newSpecs: newSpecs ? JSON.stringify(newSpecs) : undefined,
        newDesc,
        changes,
      });
      perCatCount.set(p.category, (perCatCount.get(p.category) ?? 0) + 1);
    }
  }

  console.log(`Te updaten: ${updates.length}/${products.length} producten\n`);
  console.log("─── Per categorie ───");
  for (const [cat, n] of Array.from(perCatCount.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(18)} ${n}`);
  }

  console.log("\n─── Sample (eerste 8) ───");
  for (const u of updates.slice(0, 8)) {
    console.log(`\n  ${u.slug}`);
    for (const c of u.changes) console.log(`    ${c}`);
    if (u.newDesc) console.log(`    DESC: "${u.newDesc.slice(0, 130)}..."`);
  }

  if (!APPLY) {
    console.log("\nDry-run — geen mutaties. Run met --apply om uit te voeren.");
    process.exit(0);
  }

  console.log("\nUitvoeren...");
  let ok = 0, fail = 0;
  for (const u of updates) {
    try {
      const data: Record<string, unknown> = {};
      if (u.newSpecs) data.specs = u.newSpecs;
      if (u.newDesc) data.description = u.newDesc;
      await prisma.product.update({ where: { id: u.id }, data });
      ok++;
    } catch (err) {
      fail++;
      console.log(`  ✗ ${u.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n✓ ${ok}/${updates.length} ok, ${fail} failed.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
