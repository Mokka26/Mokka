// Zet de levertijd per leverancier op het deliveryTime-veld en haalt de
// dubbele "Levertijd"-spec weg (die staat al in het levertijd-blok op de PDP).
// Niet-genoemde bronnen (Mokka HOME e.d.) houden hun bestaande levertijd
// (gemigreerd van specs.Levertijd → veld als het veld leeg was).
//
// Dry-run: npx tsx scripts/set-delivery-times.ts
// Apply:   npx tsx scripts/set-delivery-times.ts --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const WEKEN = "4 tot 8 weken";
const DAGEN = "Binnen 5 werkdagen";
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const BY_SOURCE: Record<string, string> = {
  "nive": WEKEN, "nevi": WEKEN, "saltanat": WEKEN, "mumza": WEKEN, "one world": WEKEN,
  "bss": DAGEN, "bambi": DAGEN, "bss bambi": DAGEN, "rousseau": DAGEN,
  "great home": DAGEN, "livingfurn": DAGEN,
};

async function main() {
  const prods = await p.product.findMany({
    where: { deletedAt: null },
    select: { id: true, source: true, deliveryTime: true, specs: true },
  });
  const counts: Record<string, number> = {};
  let migrated = 0, specRemoved = 0, changed = 0, untouched = 0;
  for (const pr of prods) {
    let specs: Record<string, string> = {};
    try { specs = JSON.parse(pr.specs || "{}"); } catch {}
    const specKey = Object.keys(specs).find((k) => /^\s*(levertijd|levering|leverdatum)\s*$/i.test(k));

    let delivery = pr.deliveryTime ?? null;
    // 1) migreer specs.Levertijd → veld als veld leeg
    if (!delivery && specKey && specs[specKey]) { delivery = specs[specKey]; migrated++; }
    // 2) override per leverancier
    const mapped = pr.source ? BY_SOURCE[norm(pr.source)] : undefined;
    if (mapped) { delivery = mapped; counts[pr.source!] = (counts[pr.source!] || 0) + 1; }
    // 3) verwijder dubbele spec
    const newSpecs = { ...specs };
    if (specKey) { delete newSpecs[specKey]; specRemoved++; }

    const deliveryChanged = delivery !== (pr.deliveryTime ?? null);
    const specsChanged = !!specKey;
    if (deliveryChanged || specsChanged) {
      changed++;
      if (APPLY) await p.product.update({ where: { id: pr.id }, data: { deliveryTime: delivery, specs: JSON.stringify(newSpecs) } });
    } else untouched++;
  }
  console.log(`\nProducten: ${prods.length}`);
  console.log(`  levertijd per leverancier gezet:`);
  for (const [s, n] of Object.entries(counts).sort()) console.log(`    ${s.padEnd(16)} → ${BY_SOURCE[norm(s)]}  (${n})`);
  console.log(`  gemigreerd uit specs → veld: ${migrated}`);
  console.log(`  dubbele Levertijd-spec verwijderd: ${specRemoved}`);
  console.log(`  totaal gewijzigd: ${changed} · onaangeroerd: ${untouched}`);
  console.log(APPLY ? "\n✅ Toegepast." : "\n(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
