// Volledige slug-based grouping analyse over ALLE categorieën.
// Slug = source of truth (per user). Strip recursief alle kleur-tokens
// aan het eind van de slug. Producten met identieke base-slug zijn
// kleur-varianten van zelfde model.
//
// Output:
//   - Voorgestelde nieuwe groepen (base-slug = colorGroup-naam)
//   - Producten in foute groep (huidige colorGroup ≠ voorgestelde)
//   - Producten in singleton-groep (colorGroup gezet maar geen variant-partner)
//
// Run:
//   npx tsx scripts/analyze-all-slug-groups.ts          # dry-run
//   npx tsx scripts/analyze-all-slug-groups.ts --apply  # apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

// Uitgebreide kleur-tokens (NL + EN, incl. compound deel-tokens)
const COLOR_TOKENS = [
  "grijs", "wit", "zwart", "bruin", "beige", "creme", "crème", "naturel",
  "groen", "blauw", "rood", "geel", "oranje", "paars", "roze",
  "antraciet", "taupe", "olijf",
  "goud", "zilver", "brons", "koper",
  "champagne", "ivoor", "smoke", "chroom",
  "white", "black", "grey", "gray", "brown", "cream", "gold", "silver",
  "green", "blue", "red", "yellow", "orange", "pink", "purple", "natural",
  "clear", "transparent", "ivory", "rose",
];

const COLOR_REGEX_SUFFIX = new RegExp(`-(${COLOR_TOKENS.join("|")})$`, "i");

function stripColorSuffixes(slug: string): { base: string; colors: string[] } {
  let current = slug;
  const colors: string[] = [];
  while (true) {
    const m = current.match(COLOR_REGEX_SUFFIX);
    if (!m) break;
    colors.unshift(m[1].toLowerCase());
    current = current.slice(0, -m[0].length);
  }
  return { base: current, colors };
}

async function main() {
  console.log("\n═══ Slug-based grouping analyse — alle categorieën ═══");
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true, slug: true, name: true, category: true,
      colorGroup: true, colorName: true,
    },
    orderBy: [{ category: "asc" }, { slug: "asc" }],
  });

  // Per product: base + colors uit slug
  type Item = {
    id: string; slug: string; name: string; category: string;
    currentGroup: string | null; currentColor: string | null;
    base: string; detectedColors: string[];
  };
  const items: Item[] = products.map((p) => {
    const { base, colors } = stripColorSuffixes(p.slug);
    return {
      id: p.id, slug: p.slug, name: p.name, category: p.category,
      currentGroup: p.colorGroup, currentColor: p.colorName,
      base, detectedColors: colors,
    };
  });

  // Groepeer per (category + base) — producten met zelfde base in zelfde
  // category zijn varianten van zelfde model
  const byBase = new Map<string, Item[]>();
  for (const it of items) {
    const key = `${it.category}|${it.base}`;
    const arr = byBase.get(key) ?? [];
    arr.push(it);
    byBase.set(key, arr);
  }

  type Plan = { id: string; slug: string; from: string | null; to: string | null; reason: string };
  const plans: Plan[] = [];

  // Pass 1: voor elke base-groep met ≥2 → zou samen moeten zijn
  for (const [key, group] of byBase.entries()) {
    if (group.length < 2) continue;
    const base = key.split("|")[1];
    const targetGroup = base; // colorGroup-naam = base-slug

    for (const it of group) {
      if (it.currentGroup !== targetGroup) {
        plans.push({
          id: it.id,
          slug: it.slug,
          from: it.currentGroup,
          to: targetGroup,
          reason: `move to specific base-group (${group.length} variants)`,
        });
      }
    }
  }

  // Pass 2: voor elke product met colorGroup waar base-groep slechts 1 lid heeft
  // = singleton → orphan (set colorGroup = null)
  for (const it of items) {
    if (!it.currentGroup) continue;
    const key = `${it.category}|${it.base}`;
    const group = byBase.get(key) ?? [];
    if (group.length < 2) {
      // Solo, maar heeft colorGroup → orphan
      plans.push({
        id: it.id,
        slug: it.slug,
        from: it.currentGroup,
        to: null,
        reason: "singleton orphan — geen variant-partner met zelfde base",
      });
    }
  }

  // Output summary
  const newGroups = Array.from(byBase.entries())
    .filter(([, g]) => g.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Producten totaal: ${items.length}`);
  console.log(`Voorgestelde groepen (≥2 producten met zelfde base): ${newGroups.length}\n`);

  // Toon grootste 20 groepen
  console.log("─── Top 20 grootste voorgestelde groepen ───");
  for (const [key, group] of newGroups.slice(0, 20)) {
    const base = key.split("|")[1];
    const cat = key.split("|")[0];
    console.log(`\n  [${cat}] "${base}" (${group.length} producten)`);
    for (const it of group) {
      const colors = it.detectedColors.length > 0 ? it.detectedColors.join("-") : "—";
      const cur = it.currentGroup ?? "—";
      const status = it.currentGroup === base ? "✓" : "→";
      console.log(`    ${status} ${colors.padEnd(20)} cur:"${cur.padEnd(35)}" ${it.slug}`);
    }
  }
  if (newGroups.length > 20) {
    console.log(`\n  ... en ${newGroups.length - 20} kleinere groepen`);
  }

  // Per categorie tellen
  console.log("\n─── Per categorie ───");
  const perCat = new Map<string, { groups: number; products: number }>();
  for (const [key, g] of newGroups) {
    const cat = key.split("|")[0];
    const cur = perCat.get(cat) ?? { groups: 0, products: 0 };
    cur.groups++;
    cur.products += g.length;
    perCat.set(cat, cur);
  }
  for (const [cat, s] of Array.from(perCat.entries()).sort((a, b) => b[1].groups - a[1].groups)) {
    console.log(`  ${cat.padEnd(20)} ${s.groups.toString().padStart(3)} groepen, ${s.products.toString().padStart(3)} producten`);
  }

  // Plan summary
  const planMoves = plans.filter((p) => p.to !== null);
  const planClears = plans.filter((p) => p.to === null);
  console.log(`\n─── Plan ───`);
  console.log(`  Move to specific group: ${planMoves.length}`);
  console.log(`  Clear orphan group:     ${planClears.length}`);
  console.log(`  Totaal updates:         ${plans.length}`);

  if (!APPLY) {
    console.log("\nDry-run — geen mutaties. Run met --apply om uit te voeren.");
    process.exit(0);
  }

  console.log("\nUitvoeren...");
  let ok = 0, fail = 0;
  for (const p of plans) {
    try {
      await prisma.product.update({
        where: { id: p.id },
        data: { colorGroup: p.to },
      });
      ok++;
    } catch (err) {
      fail++;
      console.log(`  ✗ ${p.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n✓ ${ok}/${plans.length} ok, ${fail} failed.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
