// Diepere analyse van verlichting-grouping op basis van slug-patroon.
// Strip RECURSIEF alle kleur-tokens aan het einde (handles white-gold,
// black-silver, brown-smoke, etc.) om de juiste base-slug te vinden.
//
// Toont:
//   1. Huidige groepen + welke daarvan inconsistent zijn
//   2. Voorgestelde nieuwe groepen op basis van betere base-slug detectie
//   3. Diff tussen huidige en voorgestelde state
//
// Run:
//   npx tsx scripts/analyze-lamp-grouping.ts          # analyseer
//   npx tsx scripts/analyze-lamp-grouping.ts --apply  # update groepen

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

// Uitgebreide kleur-tokens (NL + EN, incl. tinten)
const COLOR_TOKENS = [
  // Basiskleuren NL
  "grijs", "wit", "zwart", "bruin", "beige", "creme", "crème", "naturel",
  "groen", "blauw", "rood", "geel", "oranje", "paars", "roze",
  "antraciet", "taupe", "olijf",
  "goud", "zilver", "brons", "koper",
  "champagne", "ivoor", "smoke",
  // EN basis
  "white", "black", "grey", "gray", "brown", "cream", "gold", "silver",
  "beige", "taupe", "green", "blue", "red", "yellow", "orange",
  "pink", "purple", "natural",
  // Speciaal
  "clear", "transparent",
];

const COLOR_REGEX_SUFFIX = new RegExp(`-(${COLOR_TOKENS.join("|")})$`, "i");

// Strip RECURSIEF alle kleur-tokens aan het eind.
// "feather-...-white-gold" → "feather-...-white" → "feather-..."
// "ceiling-...-black-silver" → "ceiling-...-black" → "ceiling-..."
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
  console.log("\n═══ Analyse verlichting-grouping (recursive color-strip) ═══");
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const products = await prisma.product.findMany({
    where: { category: "verlichting", deletedAt: null },
    select: {
      id: true, slug: true, name: true,
      colorGroup: true, colorName: true,
    },
    orderBy: { slug: "asc" },
  });

  // Voor elk product: bereken de "ware" base-slug
  type Item = {
    id: string; slug: string; name: string;
    currentGroup: string | null; currentColor: string | null;
    derivedBase: string; derivedColors: string[];
  };
  const items: Item[] = products.map((p) => {
    const { base, colors } = stripColorSuffixes(p.slug);
    return {
      id: p.id, slug: p.slug, name: p.name,
      currentGroup: p.colorGroup, currentColor: p.colorName,
      derivedBase: base, derivedColors: colors,
    };
  });

  // Groepeer op derived base-slug
  const byBase = new Map<string, Item[]>();
  for (const it of items) {
    const arr = byBase.get(it.derivedBase) ?? [];
    arr.push(it);
    byBase.set(it.derivedBase, arr);
  }

  // Voorgestelde groepen: groepen met ≥2 items
  console.log("─── Voorgestelde groepen (≥2 producten met zelfde base-slug) ───");
  const proposed: { base: string; items: Item[] }[] = [];
  for (const [base, arr] of byBase.entries()) {
    if (arr.length < 2) continue;
    proposed.push({ base, items: arr });
  }
  proposed.sort((a, b) => b.items.length - a.items.length);

  type Plan = { id: string; slug: string; from: string | null; to: string };
  const plans: Plan[] = [];
  const correctlyAlreadyGrouped: string[] = [];

  for (const g of proposed) {
    // Voorgestelde groep-naam = base-slug
    const newGroup = g.base;
    // Check huidige situatie
    const currentGroups = new Set(g.items.map((i) => i.currentGroup));
    const alreadySame = currentGroups.size === 1 && !currentGroups.has(null) && Array.from(currentGroups)[0] === newGroup;
    if (alreadySame) {
      correctlyAlreadyGrouped.push(newGroup);
      continue;
    }

    console.log(`\n  → "${newGroup}"  (${g.items.length} producten)`);
    for (const it of g.items) {
      const colorStr = it.derivedColors.length > 0 ? it.derivedColors.join("-") : "—";
      const cur = it.currentGroup ?? "—";
      const arrow = cur === newGroup ? "=" : "→";
      console.log(`    ${arrow} ${colorStr.padEnd(15)} cur:"${cur}"  ${it.slug}`);
      if (cur !== newGroup) {
        plans.push({ id: it.id, slug: it.slug, from: it.currentGroup, to: newGroup });
      }
    }
  }

  // Items die in een groep zitten die GEEN ≥2 items deelt = orphan group → solo zetten
  console.log("\n─── Items in 'orphan' groepen (singleton met colorGroup gezet) ───");
  for (const it of items) {
    if (!it.currentGroup) continue;
    // Check of er andere items zijn met zelfde colorGroup
    const sameGroup = items.filter((i) => i.currentGroup === it.currentGroup);
    if (sameGroup.length === 1) {
      console.log(`  ${it.slug}  (alleen lid van "${it.currentGroup}")`);
      // Optioneel: clear naar null
      plans.push({ id: it.id, slug: it.slug, from: it.currentGroup, to: "" });
    }
  }

  console.log(`\n─── Samenvatting ───`);
  console.log(`  Voorgestelde groepen: ${proposed.length} (waarvan ${correctlyAlreadyGrouped.length} al correct)`);
  console.log(`  Plan-updates: ${plans.length}`);

  if (!APPLY) {
    console.log("\nDry-run — geen mutaties. Run met --apply om te updaten.");
    process.exit(0);
  }

  console.log("\nUitvoeren...");
  let ok = 0, fail = 0;
  for (const p of plans) {
    try {
      await prisma.product.update({
        where: { id: p.id },
        data: { colorGroup: p.to === "" ? null : p.to },
      });
      ok++;
    } catch (err) {
      fail++;
      console.log(`  ✗ ${p.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n✓ ${ok}/${plans.length} updates ok, ${fail} failed.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
