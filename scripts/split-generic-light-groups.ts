// Splits te-generieke colorGroups in verlichting:
//   - "floor-lamp": gh-art1017 paar krijgt eigen groep, ql10621 wordt solo
//   - "ceiling-lamp": elke isabel-XXX model krijgt eigen groep, ql10668 solo
//
// Run:
//   npx tsx scripts/split-generic-light-groups.ts          # dry-run
//   npx tsx scripts/split-generic-light-groups.ts --apply  # apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

// Regenereer specifieke colorGroup uit slug — strip kleur-suffix
const COLOR_TOKENS = "black|white|gold|silver|brown|grey|gray|cream|red|green|blue|zwart|wit|goud|zilver|bruin|grijs|cremeer|creme|brons|koper|antraciet|champagne";
const COLOR_SUFFIX_REGEX = new RegExp(`-(${COLOR_TOKENS})$`, "i");

function deriveGroup(slug: string): string {
  return slug.replace(COLOR_SUFFIX_REGEX, "");
}

async function main() {
  console.log("\n═══ Splits generieke verlichting-groepen ═══");
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const generic = ["floor-lamp", "ceiling-lamp"];

  for (const groupName of generic) {
    const members = await prisma.product.findMany({
      where: { colorGroup: groupName, deletedAt: null, category: "verlichting" },
      select: { id: true, slug: true, name: true, colorName: true },
    });

    if (members.length === 0) continue;

    console.log(`─── Groep "${groupName}" (${members.length} producten) ───`);

    // Per slug → derive nieuwe specifieke group
    type Plan = { id: string; slug: string; from: string; to: string | null };
    const plans: Plan[] = [];

    // Groepeer per derived prefix
    const byDerived = new Map<string, typeof members>();
    for (const m of members) {
      const d = deriveGroup(m.slug);
      const arr = byDerived.get(d) ?? [];
      arr.push(m);
      byDerived.set(d, arr);
    }

    for (const [derived, arr] of byDerived.entries()) {
      if (arr.length >= 2) {
        // Echte variant-paar/trio → nieuwe specifieke groep
        for (const m of arr) {
          plans.push({ id: m.id, slug: m.slug, from: groupName, to: derived });
        }
        console.log(`  → "${derived}" (${arr.length}× echte varianten):`);
        for (const m of arr) console.log(`      ${m.slug}`);
      } else {
        // Solo: groep verwijderen (null)
        for (const m of arr) {
          plans.push({ id: m.id, slug: m.slug, from: groupName, to: null });
        }
        console.log(`  → solo (geen groep meer):`);
        for (const m of arr) console.log(`      ${m.slug}`);
      }
    }

    if (APPLY) {
      for (const p of plans) {
        await prisma.product.update({
          where: { id: p.id },
          data: { colorGroup: p.to },
        });
      }
      console.log(`  ✓ ${plans.length} producten geupdate`);
    }
    console.log("");
  }

  if (!APPLY) {
    console.log("Dry-run — geen mutaties. Run met --apply om te splitsen.");
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
