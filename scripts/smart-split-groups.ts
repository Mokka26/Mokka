// Slimmere groep-splitter: detecteert per colorGroup of leden VERSCHILLENDE
// model-codes hebben. Model-code = alfanumeric token met cijfers (bv
// gh-art1015, ql10620, zb-5702, gh1116-60x60x110).
//
// Splits-regel:
//   - Als alle leden ZELFDE model-codes set → consistent, skip (zoals
//     chair-noor-zb-5702-fy2415-no-5/no-6 = zelfde stoel-model)
//   - Als leden VERSCHILLENDE model-codes → split per (derived-base of model)
//
// Run:
//   npx tsx scripts/smart-split-groups.ts          # dry-run
//   npx tsx scripts/smart-split-groups.ts --apply  # apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

// Model-code = alfanumeric token met minstens 1 cijfer EN minstens 1 letter.
// Pakt: gh-art1015 (komt als 1 segment niet pakken want bevat -, dus 2 segments
// "gh" en "art1015"; "art1015" matched), ql10620, zb-5702 (zb + 5702), gh1116
// Specifieke aandacht: prefixen als "gh-art", "zb-" zijn deel van model-code.
// Strategie: token-by-token, een token telt als model-code als het cijfers heeft
const COLOR_TOKENS_SET = new Set([
  "grijs","wit","zwart","bruin","beige","creme","crème","naturel","groen","blauw",
  "rood","geel","oranje","paars","roze","antraciet","taupe","olijf","goud",
  "zilver","brons","koper","champagne","ivoor","smoke",
  "white","black","grey","gray","brown","cream","gold","silver","green","blue",
  "red","yellow","orange","pink","purple","natural","clear","transparent",
]);

// Extract "model-codes" uit slug: tokens (gescheiden door -) die cijfers hebben.
// Sommige zijn ook variant-aanduidingen (no-5, no-6, fy2415-no-5). We pakken
// alle cijfers-tokens; vergelijken op SET-niveau.
function extractModelCodes(slug: string): Set<string> {
  const tokens = slug.split("-");
  const codes = new Set<string>();
  for (const t of tokens) {
    if (!t) continue;
    if (COLOR_TOKENS_SET.has(t.toLowerCase())) continue;
    // Token moet ≥3 chars zijn (filtert variant-aanduidingen als '5','6','no')
    if (t.length < 3) continue;
    // Token met cijfers (echte model-codes zoals 5702, art1015, ql10620, 60x60x110)
    if (/\d/.test(t)) codes.add(t.toLowerCase());
  }
  return codes;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

async function main() {
  console.log("\n═══ Smart-split colorGroups op model-codes ═══");
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const products = await prisma.product.findMany({
    where: { deletedAt: null, colorGroup: { not: null } },
    select: { id: true, slug: true, colorGroup: true },
  });

  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const arr = groups.get(p.colorGroup!) ?? [];
    arr.push(p);
    groups.set(p.colorGroup!, arr);
  }

  type Plan = { id: string; slug: string; from: string; to: string | null };
  const plans: Plan[] = [];

  for (const [groupName, members] of groups.entries()) {
    if (members.length < 2) continue;

    // Extract model-codes per lid
    const memberCodes = members.map((m) => ({ ...m, codes: extractModelCodes(m.slug) }));

    // Als ALLE leden zelfde model-codes set → consistent
    const firstCodes = memberCodes[0].codes;
    const allSame = memberCodes.every((m) => setsEqual(m.codes, firstCodes));
    if (allSame) continue;

    // Inconsistent: print + plan
    console.log(`\n⚠ "${groupName}" inconsistent (${members.length} leden, verschillende model-codes)`);
    for (const m of memberCodes) {
      const codesStr = Array.from(m.codes).join(",") || "(geen)";
      console.log(`    ${m.slug}  [codes: ${codesStr}]`);
    }
    // Splits-strategie: groepeer leden per identieke codes-set
    const byCodes = new Map<string, typeof memberCodes>();
    for (const m of memberCodes) {
      const key = Array.from(m.codes).sort().join("|");
      const arr = byCodes.get(key) ?? [];
      arr.push(m);
      byCodes.set(key, arr);
    }
    for (const [key, arr] of byCodes.entries()) {
      const target = arr.length >= 2
        // Nieuwe groep-naam = base-slug van eerste lid (strip kleur-suffix)
        ? arr[0].slug.replace(new RegExp(`-(${Array.from(COLOR_TOKENS_SET).join("|")})$`, "i"), "")
        : null;
      for (const m of arr) {
        if (m.colorGroup !== target) {
          plans.push({ id: m.id, slug: m.slug, from: groupName, to: target });
        }
      }
      console.log(`      → ${target ?? "solo"} (${arr.length}×)`);
    }
  }

  console.log(`\n─── Samenvatting ───`);
  console.log(`Totaal updates: ${plans.length} producten`);

  if (!APPLY) {
    console.log("\nDry-run — geen mutaties. Run met --apply om uit te voeren.");
    process.exit(0);
  }

  console.log("\nUitvoeren...");
  let ok = 0;
  for (const p of plans) {
    try {
      await prisma.product.update({ where: { id: p.id }, data: { colorGroup: p.to } });
      ok++;
    } catch (err) {
      console.log(`  ✗ ${p.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n✓ ${ok}/${plans.length} ok.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
