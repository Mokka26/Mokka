/**
 * P0 cleanup voor banken/hoekbanken:
 *   1. Color grouping op basis van stof-finish (Kemer, Riviera, Monolith, etc.)
 *   2. Specs aanvullen met Serie + Stoffering + Categorie uit slug-patroon
 *
 * Slug-patroon: "bolton-riviera-hoekbank", "new-bolton-kronos-hoekbank"
 * Name-patroon: "Bolton (Riviera) Hoekbank"
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

// Stoffering → hex kleur mapping (representatief van de stof-tint)
const FABRIC_HEX: Record<string, string> = {
  riviera: "#94A8AC",
  kemer: "#C9B89A",
  monolith: "#6D6E72",
  magic: "#2C2D30",
  kronos: "#7B6E5E",
  croco: "#5D3F2E",
  preston: "#8B847C",
  "genova texarm": "#D9CFC4",
  genova: "#D9CFC4",
  texarm: "#D9CFC4",
  "relax decowit": "#E5DDD0",
  "relax_decowit": "#E5DDD0",
  decowit: "#E5DDD0",
  soro: "#6A7682",
  fresh: "#D8C9B3",
  abramo3: "#7A5A3F",
  abramo: "#7A5A3F",
};

function titleCase(s: string): string {
  return s.toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Parse "Bolton (Riviera) Hoekbank" → { base: "Bolton", fabric: "Riviera", type: "Hoekbank" }
// Parse "Bonna (Monolith) Loungebank" → { base: "Bonna", fabric: "Monolith", type: "Loungebank" }
function parseName(name: string): { base: string; fabric?: string; type: string } {
  const m = name.match(/^(.+?)\s*\(([^)]+)\)\s*(Hoekbank|Loungebank|U-Bank|Bank)?$/i);
  if (m) {
    return { base: m[1].trim(), fabric: m[2].trim(), type: m[3] ?? "Bank" };
  }
  // Geen parenthesis — split op type-keyword
  const m2 = name.match(/^(.+?)\s+(Hoekbank|Loungebank|U-Bank|Bank)$/i);
  if (m2) return { base: m2[1].trim(), type: m2[2] };
  return { base: name, type: "Bank" };
}

// Stap 1: laad alle zichtbare banken/hoekbanken
const banken = await prisma.$queryRaw<Array<{
  id: string; slug: string; name: string; specs: string | null;
  category: string; colorGroup: string | null;
}>>`
  SELECT id, slug, name, specs, category, "colorGroup" FROM "Product"
  WHERE category IN ('banken','hoekbanken') AND hidden = false
  ORDER BY slug
`;

console.log(`Process ${banken.length} zichtbare banken/hoekbanken\n`);

// Stap 2: groepeer op base+type voor color grouping
interface GroupItem {
  id: string; slug: string; name: string; fabric?: string; base: string; type: string;
}
const groups = new Map<string, GroupItem[]>();
for (const b of banken) {
  const parsed = parseName(b.name);
  const groupKey = slugify(`${parsed.base} ${parsed.type}`);
  const arr = groups.get(groupKey) ?? [];
  arr.push({ id: b.id, slug: b.slug, name: b.name, ...parsed });
  groups.set(groupKey, arr);
}

// Stap 3: process per groep
let groupedCount = 0;
let singletonCount = 0;
let specsUpdated = 0;

for (const [groupKey, items] of groups) {
  const isGroup = items.length >= 2;

  for (const item of items) {
    // Bouw nieuwe specs
    let specs: Record<string, string> = {};
    try {
      const parsed = JSON.parse(banken.find((b) => b.id === item.id)?.specs ?? "{}");
      if (parsed && typeof parsed === "object") specs = parsed;
    } catch {}

    // Stoffering
    if (item.fabric) {
      specs.Stoffering = titleCase(item.fabric);
      specs.Serie = item.base;
    } else if (!specs.Serie) {
      specs.Serie = item.base;
    }

    // Categorie label
    const catLabel = item.type === "Hoekbank" ? "Hoekbank" :
      item.type === "Loungebank" ? "Loungebank" :
      item.type === "U-Bank" ? "U-Bank" : "Bank";
    specs.Categorie = catLabel;

    if (!specs.Levertijd) specs.Levertijd = "4-6 weken";

    // Color grouping
    const colorName = item.fabric ? titleCase(item.fabric) : null;
    const colorHex = item.fabric ? FABRIC_HEX[item.fabric.toLowerCase()] ?? null : null;

    const data: {
      specs: string;
      colorGroup?: string | null;
      colorName?: string | null;
      colorHex?: string | null;
    } = { specs: JSON.stringify(specs) };

    if (isGroup) {
      data.colorGroup = groupKey;
      data.colorName = colorName;
      data.colorHex = colorHex;
    }

    await prisma.product.update({
      where: { id: item.id },
      data,
    });
    specsUpdated++;
  }

  if (isGroup) {
    console.log(`  [GROUP ${groupKey}] ${items.length} variants:`);
    for (const it of items) console.log(`    ${it.slug.padEnd(40)} ${it.fabric ?? "—"}`);
    groupedCount++;
  } else {
    singletonCount++;
  }
}

console.log(`\n=== Resultaat ===`);
console.log(`  ${groupedCount} color-groepen (2+ varianten)`);
console.log(`  ${singletonCount} singletons (geen groep)`);
console.log(`  ${specsUpdated} producten specs geüpdate`);

await prisma.$disconnect();
