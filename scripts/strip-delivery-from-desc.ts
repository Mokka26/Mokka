// Haalt levertijd-tekst uit de productbeschrijving (die staat nu in een apart
// veld). Strikt: alleen "Levertijd: …"-zinnen en een losstaande levertijd-
// frase aan het eind ("4 tot 8 weken"). Legitieme tekst blijft staan.
//
// Dry-run: npx tsx scripts/strip-delivery-from-desc.ts
// Apply:   npx tsx scripts/strip-delivery-from-desc.ts --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function strip(d: string): string {
  let s = d;
  // "Levertijd: …." (tot eerste punt) — incl. eventuele losse variant ervoor
  s = s.replace(/\s*Levertijd\s*:?\s*[^.\n]*\.?/gi, " ");
  // losse levertijd-frase aan het eind, zonder "Levertijd"-label
  // (alleen spaties ervoor opeten, niet de punt van de vorige zin)
  s = s.replace(/\s*(?:binnen\s+)?\d+\s*(?:tot|t\/m|–|-)\s*\d+\s*(?:weken|werkdagen)\s*\.?\s*$/i, "");
  s = s.replace(/\s*binnen\s+\d+\s+werkdagen\s*\.?\s*$/i, "");
  return s.replace(/\s+\./g, ".").replace(/\s{2,}/g, " ").trim();
}

async function main() {
  const all = await p.product.findMany({ where: { deletedAt: null }, select: { id: true, description: true } });
  let changed = 0;
  const sample: string[] = [];
  for (const pr of all) {
    const cleaned = strip(pr.description || "");
    if (cleaned !== (pr.description || "")) {
      changed++;
      if (sample.length < 8) sample.push(`  VOOR: ${pr.description}\n  NA:   ${cleaned}\n`);
      if (APPLY) await p.product.update({ where: { id: pr.id }, data: { description: cleaned } });
    }
  }
  console.log(`\nBeschrijvingen aangepast: ${changed} / ${all.length}\n`);
  console.log(sample.join("\n"));
  console.log(APPLY ? "✅ Toegepast." : "(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
