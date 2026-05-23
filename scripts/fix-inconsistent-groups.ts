// Voor ELKE bestaande colorGroup: check of alle leden dezelfde derived-base
// hebben. Zo niet → split per base. Sub-groep met ≥2 = nieuwe specifieke groep,
// sub-groep met 1 = solo (null).
//
// Lost o.a. op: table-lamp met verschillende model-codes (ql10620 + gh-art1015)
// die door earlier strict-match niet gesplitst werden.
//
// Run:
//   npx tsx scripts/fix-inconsistent-groups.ts          # dry-run
//   npx tsx scripts/fix-inconsistent-groups.ts --apply  # apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const COLOR_TOKENS = [
  "grijs", "wit", "zwart", "bruin", "beige", "creme", "crème", "naturel",
  "groen", "blauw", "rood", "geel", "oranje", "paars", "roze",
  "antraciet", "taupe", "olijf",
  "goud", "zilver", "brons", "koper",
  "champagne", "ivoor", "smoke",
  "white", "black", "grey", "gray", "brown", "cream", "gold", "silver",
  "beige", "taupe", "green", "blue", "red", "yellow", "orange",
  "pink", "purple", "natural",
  "clear", "transparent",
];

const COLOR_REGEX_SUFFIX = new RegExp(`-(${COLOR_TOKENS.join("|")})$`, "i");

function stripColorSuffixes(slug: string): string {
  let current = slug;
  while (true) {
    const m = current.match(COLOR_REGEX_SUFFIX);
    if (!m) break;
    current = current.slice(0, -m[0].length);
  }
  return current;
}

async function main() {
  console.log("\n═══ Fix inconsistente colorGroups ═══");
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const products = await prisma.product.findMany({
    where: { deletedAt: null, colorGroup: { not: null } },
    select: { id: true, slug: true, name: true, category: true, colorGroup: true },
  });

  // Groepeer per huidige colorGroup
  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const g = p.colorGroup!;
    const arr = groups.get(g) ?? [];
    arr.push(p);
    groups.set(g, arr);
  }

  type Plan = { id: string; slug: string; from: string; to: string | null; reason: string };
  const plans: Plan[] = [];

  for (const [groupName, members] of groups.entries()) {
    if (members.length < 2) continue;

    // Splits per derived-base
    const byBase = new Map<string, typeof members>();
    for (const m of members) {
      const base = stripColorSuffixes(m.slug);
      const arr = byBase.get(base) ?? [];
      arr.push(m);
      byBase.set(base, arr);
    }

    // Als alle leden zelfde base → groep is consistent, skip
    if (byBase.size === 1) continue;

    console.log(`\n⚠ Inconsistente groep "${groupName}" (${members.length} leden, ${byBase.size} verschillende bases)`);
    for (const [base, arr] of byBase.entries()) {
      const newTarget = arr.length >= 2 ? base : null;
      const reason = arr.length >= 2 ? `nieuwe groep "${base}"` : "solo (geen variant-partner)";
      console.log(`  → ${reason}:`);
      for (const m of arr) {
        console.log(`      ${m.slug}`);
        if (m.colorGroup !== newTarget) {
          plans.push({
            id: m.id,
            slug: m.slug,
            from: groupName,
            to: newTarget,
            reason,
          });
        }
      }
    }
  }

  console.log(`\n─── Samenvatting ───`);
  console.log(`Totaal updates: ${plans.length} producten`);

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
  console.log(`\n✓ ${ok}/${plans.length} updates ok, ${fail} failed.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
