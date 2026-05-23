// Vind producten die echte kleur-varianten van elkaar zijn (zelfde model,
// andere kleur) maar nog niet in een colorGroup zitten.
//
// Confidence-scoring:
//   - HOOG: slug-prefix tot kleur-segment is identiek (= zelfde model)
//     OF: minstens 1 product in de groep heeft al een colorGroup
//   - LAAG: groep met verschillende model-codes (gh1101 vs gh1104)
//
// Print alleen HOOG-confidence; --apply zet alleen die.
//
// Run:
//   npx tsx scripts/find-ungrouped-color-variants.ts
//   npx tsx scripts/find-ungrouped-color-variants.ts --apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const COLOR_TOKENS = [
  "grijs", "wit", "zwart", "bruin", "beige", "creme", "crème", "naturel",
  "groen", "blauw", "rood", "geel", "oranje", "paars", "roze",
  "antraciet", "taupe", "olijf", "mosgroen", "okergeel", "lichtgrijs",
  "donkergrijs", "donkerblauw", "lichtblauw", "lichtbruin", "donkerbruin",
  "goud", "zilver", "brons", "koper",
  "champagne", "ivoor",
  // English equivalents in slugs
  "white", "black", "grey", "gray", "brown", "cream", "gold", "silver",
  "beige", "taupe", "green", "blue", "red",
];

const COLOR_REGEX_NAME = new RegExp(`\\s+(${COLOR_TOKENS.join("|")})\\s*$`, "i");
const COLOR_REGEX_SLUG = new RegExp(`-(${COLOR_TOKENS.join("|")})$`, "i");

function normalizeName(name: string): string {
  return name.replace(COLOR_REGEX_NAME, "").trim().toLowerCase();
}

function extractColor(name: string): string | null {
  const m = name.match(COLOR_REGEX_NAME);
  return m ? m[1].toLowerCase() : null;
}

// Slug-prefix VOOR het kleur-segment — als deze gelijk is tussen 2 producten,
// dan zijn ze hoogstwaarschijnlijk varianten van zelfde model
function slugPrefix(slug: string): string {
  return slug.replace(COLOR_REGEX_SLUG, "");
}

function suggestGroupSlug(name: string): string {
  return normalizeName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("\n═══ HOOG-confidence kleur-varianten ═══");
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true, slug: true, name: true, category: true,
      colorGroup: true, colorName: true, hidden: true,
    },
  });

  // Groepeer op (category, normalizedName)
  type Entry = {
    id: string; slug: string; name: string; category: string;
    colorGroup: string | null; colorName: string | null; hidden: boolean;
    detectedColor: string | null; slugPrefix: string;
  };
  const byName = new Map<string, Entry[]>();
  for (const p of products) {
    const norm = normalizeName(p.name);
    if (norm.length < 3) continue;
    const key = `${p.category}|${norm}`;
    const arr = byName.get(key) ?? [];
    arr.push({
      id: p.id, slug: p.slug, name: p.name, category: p.category,
      colorGroup: p.colorGroup, colorName: p.colorName, hidden: p.hidden,
      detectedColor: extractColor(p.name),
      slugPrefix: slugPrefix(p.slug),
    });
    byName.set(key, arr);
  }

  type Action = {
    key: string; products: Entry[];
    suggestedGroup: string;
    reason: string;
  };
  const actions: Action[] = [];

  for (const [key, entries] of byName.entries()) {
    if (entries.length < 2) continue;

    // Skip als alle ZELFDE colorGroup
    const groups = new Set(entries.map((e) => e.colorGroup));
    if (groups.size === 1 && !groups.has(null)) continue;

    // STRENGE CHECK: groep entries verder per slug-prefix. Producten met
    // verschillende slug-prefixen zijn andere modellen (bv floor-lamp-ql10623
    // vs floor-lamp-ql10627), niet kleur-varianten.
    const byPrefix = new Map<string, Entry[]>();
    for (const e of entries) {
      const arr = byPrefix.get(e.slugPrefix) ?? [];
      arr.push(e);
      byPrefix.set(e.slugPrefix, arr);
    }

    for (const [prefix, subEntries] of byPrefix.entries()) {
      if (subEntries.length < 2) continue;
      // Alle moeten kleur hebben (anders niet duidelijk dat varianten zijn)
      const allHaveColor = subEntries.every((e) => e.detectedColor || e.colorName);
      if (!allHaveColor) continue;
      // Alle al in zelfde colorGroup? Skip
      const subGroups = new Set(subEntries.map((e) => e.colorGroup));
      if (subGroups.size === 1 && !subGroups.has(null)) continue;
      // Suggest groep: bestaande gebruiken indien aanwezig EN specifiek genoeg,
      // anders slug-prefix zelf (uniek per model: "ceiling-lamp-gh1104-60" i.p.v.
      // generieke "ceiling-lamp")
      const existing = subEntries.find((e) => e.colorGroup)?.colorGroup;
      // Bestaande groep gebruiken ALLEEN als het matcht met slug-prefix
      // (anders is bestaande groep zelf te generiek)
      const useExisting = existing && prefix.startsWith(existing);
      const suggestedGroup = useExisting ? existing : prefix;
      const reason = useExisting
        ? `${subEntries.filter(e => e.colorGroup === existing).length}/${subEntries.length} al in "${existing}", aanvullen`
        : `${subEntries.length} delen slug-prefix "${prefix}"`;
      actions.push({ key: `${key}|${prefix}`, products: subEntries, suggestedGroup, reason });
    }
  }

  if (actions.length === 0) {
    console.log("✓ Geen high-confidence ongegroepeerde varianten.");
    process.exit(0);
  }

  console.log(`${actions.length} groepen high-confidence:\n`);
  let totalToGroup = 0;
  for (const a of actions) {
    const cat = a.key.split("|")[0];
    console.log(`  [${cat}] → colorGroup "${a.suggestedGroup}"`);
    console.log(`    reden: ${a.reason}`);
    for (const p of a.products) {
      const status = p.hidden ? "[HIDDEN]" : "[ZICHTB]";
      const cur = p.colorGroup ?? "—";
      const color = p.detectedColor ?? p.colorName ?? "?";
      const willUpdate = p.colorGroup !== a.suggestedGroup;
      const arrow = willUpdate ? "→" : "=";
      console.log(`    ${status} ${arrow} group:"${cur}" color:"${color}"  ${p.slug}`);
      if (willUpdate) totalToGroup++;
    }
    console.log("");
  }
  console.log(`Totaal updates: ${totalToGroup} producten\n`);

  if (!APPLY) {
    console.log("Dry-run — geen mutaties. Run met --apply om high-confidence te groeperen.");
    process.exit(0);
  }

  console.log("Uitvoeren...");
  let ok = 0;
  let fail = 0;
  for (const a of actions) {
    for (const p of a.products) {
      if (p.colorGroup === a.suggestedGroup) continue;
      try {
        const data: { colorGroup: string; colorName?: string } = { colorGroup: a.suggestedGroup };
        if (!p.colorName && p.detectedColor) {
          data.colorName = p.detectedColor.charAt(0).toUpperCase() + p.detectedColor.slice(1);
        }
        await prisma.product.update({ where: { id: p.id }, data });
        ok++;
      } catch (err) {
        fail++;
        console.log(`  ✗ ${p.slug}: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`  ✓ ${a.suggestedGroup}`);
  }
  console.log(`\n✓ ${ok} updates ok, ${fail} failed.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
