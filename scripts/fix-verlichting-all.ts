// Fix-all script voor verlichting categorie:
//   1. Afmetingen aanvullen uit slug-patroon waar leeg
//   2. Materiaal default "Metaal" waar leeg (overschrijft niet)
//      Smart: source="travertine"/"organic"/"resin" → "Travertijn"/"Hars"
//   3. Description hergenereren naar unieke, factual templates (vervangt
//      boilerplate "Lamp uit de X-serie, ... Premium kwaliteit met duurzame
//      materialen.")
//   4. feather-gh1754-gold-white colorName fix ("?" → "Goud-wit")
//   5. Featured-flag op 6 representatieve lampen
//
// Run:
//   npx tsx scripts/fix-verlichting-all.ts          # dry-run
//   npx tsx scripts/fix-verlichting-all.ts --apply  # apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

interface Specs {
  Categorie?: string;
  Serie?: string;
  Afmetingen?: string;
  Materiaal?: string;
  Kleur?: string;
  Vermogen?: string;
  Levertijd?: string;
  [k: string]: string | undefined;
}

function parseSpecs(s: string | null): Specs {
  if (!s) return {};
  try {
    const o = JSON.parse(s);
    return typeof o === "object" && o ? o : {};
  } catch {
    return {};
  }
}

// Pak afmetingen uit slug. Patterns:
//   -160x40x110-...  → "160 × 40 × 110 cm"
//   -100x60-...      → "100 × 60 cm"
//   -50               → "Ø 50 cm" (alleen als laatste segment vóór kleur is puur cijfer)
//   -3l-30-x40-x30   → "30 × 40 × 30 cm" (verwerk x-prefix)
function extractDims(slug: string): string | null {
  // Multi-dim NxNxN(xN)
  const triple = slug.match(/(\d+)x(\d+)x(\d+)(?:x(\d+))?/);
  if (triple) {
    const parts = [triple[1], triple[2], triple[3]];
    if (triple[4]) parts.push(triple[4]);
    return parts.join(" × ") + " cm";
  }
  // Dubbel NxN
  const dbl = slug.match(/-(\d+)x(\d+)(?:-|$)/);
  if (dbl) return `${dbl[1]} × ${dbl[2]} cm`;
  return null;
}

// Smart materiaal-detect uit slug + name
function detectMateriaal(slug: string, name: string): string {
  const txt = `${slug} ${name}`.toLowerCase();
  if (/travertine|travertijn/.test(txt)) return "Travertijn";
  if (/organic.*resin|resin/.test(txt)) return "Hars";
  if (/wood|hout|teak/.test(txt)) return "Hout";
  if (/glass|glas/.test(txt)) return "Glas";
  if (/marble|marmer/.test(txt)) return "Marmer";
  return "Metaal"; // default voor lampen
}

// Lamp-type uit slug
function detectLampType(slug: string): string {
  if (slug.startsWith("ceiling-lamp")) return "Plafondlamp";
  if (slug.startsWith("floor-lamp")) return "Vloerlamp";
  if (slug.startsWith("table-lamp")) return "Tafellamp";
  if (slug.startsWith("wall-lamp") || /wall-led/.test(slug)) return "Wandlamp";
  if (slug.includes("decoration")) return "Decoratielamp";
  if (slug.includes("feather")) return "Wandlamp";
  return "Lamp";
}

// Genereer unieke description per product. Factual, geen marketing-claims.
function generateDescription(p: {
  slug: string; name: string; colorName: string | null;
  specs: Specs; lampType: string;
}): string {
  const { name, colorName, specs, lampType } = p;
  const parts: string[] = [];

  // Opening
  const kleurDeel = colorName && colorName !== "?" ? ` in ${colorName.toLowerCase()}` : "";
  parts.push(`${lampType}${kleurDeel}.`);

  // Serie als context
  if (specs.Serie && specs.Serie.toLowerCase() !== name.toLowerCase()) {
    parts.push(`Onderdeel van de ${specs.Serie.charAt(0).toUpperCase()}${specs.Serie.slice(1).toLowerCase()}-collectie.`);
  }

  // Afmetingen
  if (specs.Afmetingen) {
    parts.push(`Afmetingen: ${specs.Afmetingen}.`);
  }

  // Materiaal
  if (specs.Materiaal) {
    parts.push(`Uitgevoerd in ${specs.Materiaal.toLowerCase()}.`);
  }

  // Levertijd
  if (specs.Levertijd) {
    parts.push(`Levertijd: ${specs.Levertijd}.`);
  }

  return parts.join(" ");
}

// Featured-selectie: 6 lampen verspreid over types + prijspunten
const FEATURED_SLUGS = [
  // Te bepalen na inspectie — kies later
];

async function main() {
  console.log("\n═══ Fix-all verlichting ═══");
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const products = await prisma.product.findMany({
    where: { category: "verlichting", deletedAt: null, hidden: false },
    select: {
      id: true, slug: true, name: true, description: true,
      specs: true, colorName: true, price: true, featured: true,
    },
  });

  type Update = {
    id: string; slug: string;
    newSpecs?: Specs; newDesc?: string;
    newColorName?: string; newFeatured?: boolean;
    changes: string[];
  };
  const updates: Update[] = [];

  for (const p of products) {
    const specs = parseSpecs(p.specs);
    const lampType = detectLampType(p.slug);
    const changes: string[] = [];
    let newSpecs: Specs = { ...specs };
    let newDesc: string | undefined;
    let newColorName: string | undefined;

    // 1. Afmetingen aanvullen
    if (!specs.Afmetingen) {
      const dims = extractDims(p.slug);
      if (dims) {
        newSpecs.Afmetingen = dims;
        changes.push(`+Afmetingen: ${dims}`);
      }
    }

    // 2. Materiaal default
    if (!specs.Materiaal) {
      const mat = detectMateriaal(p.slug, p.name);
      newSpecs.Materiaal = mat;
      changes.push(`+Materiaal: ${mat}`);
    }

    // 4. ColorName fix voor feather-gh1754-gold-white
    if (p.slug === "feather-gh1754-b058-1200-wall-led-lamp-gold-white" && (!p.colorName || p.colorName === "?")) {
      newColorName = "Goud-wit";
      changes.push(`+ColorName: Goud-wit`);
    }

    // 3. Description regenereren (vervangt boilerplate)
    const isBoilerplate = !p.description ||
      /Premium kwaliteit met duurzame materialen/i.test(p.description) ||
      p.description.length < 30;
    if (isBoilerplate) {
      // Gebruik nieuwe specs (al gemerged) voor description-generation
      newDesc = generateDescription({
        slug: p.slug, name: p.name,
        colorName: newColorName ?? p.colorName,
        specs: newSpecs, lampType,
      });
      changes.push(`~Description`);
    }

    if (changes.length > 0) {
      updates.push({
        id: p.id, slug: p.slug,
        newSpecs: newSpecs !== specs ? newSpecs : undefined,
        newDesc, newColorName,
        changes,
      });
    }
  }

  // 5. Featured: pak 6 representatieve lampen
  // - 2 plafond (1 goud, 1 zwart)
  // - 2 vloer
  // - 2 tafel
  const featuredCandidates: string[] = [];
  const byType = {
    plafond: products.filter((p) => p.slug.startsWith("ceiling-lamp") && p.price >= 200),
    vloer: products.filter((p) => p.slug.startsWith("floor-lamp")),
    tafel: products.filter((p) => p.slug.startsWith("table-lamp")),
  };
  for (const arr of Object.values(byType)) {
    const sorted = arr.sort((a, b) => b.price - a.price);
    featuredCandidates.push(...sorted.slice(0, 2).map((p) => p.slug));
  }

  console.log(`Te updaten: ${updates.length}/${products.length} producten`);
  console.log(`Featured kandidaten: ${featuredCandidates.length}\n`);

  console.log("─── Sample updates (eerste 10) ───");
  for (const u of updates.slice(0, 10)) {
    console.log(`\n  ${u.slug}`);
    for (const c of u.changes) console.log(`    ${c}`);
    if (u.newDesc) console.log(`    DESC: "${u.newDesc.slice(0, 120)}..."`);
  }

  console.log(`\n─── Featured selectie ───`);
  for (const s of featuredCandidates) console.log(`  ⭐ ${s}`);

  if (!APPLY) {
    console.log("\nDry-run — geen mutaties. Run met --apply om uit te voeren.");
    process.exit(0);
  }

  console.log("\nUitvoeren...");
  let ok = 0, fail = 0;

  // Apply updates
  for (const u of updates) {
    try {
      const data: Record<string, unknown> = {};
      if (u.newSpecs) data.specs = JSON.stringify(u.newSpecs);
      if (u.newDesc) data.description = u.newDesc;
      if (u.newColorName) data.colorName = u.newColorName;
      await prisma.product.update({ where: { id: u.id }, data });
      ok++;
    } catch (err) {
      fail++;
      console.log(`  ✗ ${u.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Featured-flag
  await prisma.product.updateMany({
    where: { slug: { in: featuredCandidates } },
    data: { featured: true },
  });

  console.log(`\n✓ ${ok}/${updates.length} updates ok, ${fail} failed.`);
  console.log(`✓ ${featuredCandidates.length} producten op featured gezet.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
