// Herstelt vaste taalfouten in productnamen, -specs en -beschrijvingen:
//  - "de Tokyo bankstel" → "het Tokyo bankstel", "een bankstel die" → "een bankstel dat",
//    "deze dressoir" → "dit dressoir" (het-woorden uit de beschrijvingssjablonen)
//  - "zit-comfort" → "zitcomfort"
//  - verkeerde tekens: U+0307 (Turkse i̇ na lowercasing), U+0660 (Arabisch-Indische nul), nbsp
//
// Dry-run: npx tsx --env-file=.env.local scripts/fix-copy-grammar.ts
// Apply:   npx tsx --env-file=.env.local scripts/fix-copy-grammar.ts <backup.json> --apply
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BACKUP = process.argv.find((a, i) => i > 1 && !a.startsWith("--"));

const HET = "bankstel|dressoir|tv-meubel|bed|meubel|bureau|nachtkastje|kastje|wandmeubel|ladekastje|hoofdbord|ledikant";
const NAME = "(?:[\\p{Lu}0-9][\\p{L}\\p{M}0-9'’-]*\\s+){1,3}";

function fixText(s: string): string {
  return s
    .replace(/[̇٠]/g, "")
    .replace(/ /g, " ")
    .replace(new RegExp(`\\b([Dd])e (${NAME})(${HET})\\b`, "gu"), (_m, d: string, name: string, noun: string) => `${d === "D" ? "Het" : "het"} ${name}${noun}`)
    .replace(new RegExp(`\\b(een (?:${HET})) die\\b`, "g"), "$1 dat")
    .replace(new RegExp(`\\b([Dd])eze (${HET})\\b`, "g"), (_m, d: string, noun: string) => `${d === "D" ? "Dit" : "dit"} ${noun}`)
    .replace(/\bzit-comfort\b/g, "zitcomfort");
}

async function main() {
  const rows = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true, specs: true, description: true },
  });
  const changes = rows
    .map((r) => ({ r, name: fixText(r.name).trim(), specs: r.specs.replace(/[̇٠]/g, ""), description: fixText(r.description) }))
    .filter((c) => c.name !== c.r.name || c.specs !== c.r.specs || c.description !== c.r.description);

  console.log(`${rows.length} producten · ${changes.length} met een correctie`);
  for (const c of changes.slice(0, 30)) {
    if (c.name !== c.r.name) console.log(`  naam  ${c.r.slug}: ${JSON.stringify(c.r.name)} → ${JSON.stringify(c.name)}`);
    if (c.description !== c.r.description) {
      const a = [...c.r.description];
      const b = [...c.description];
      const i = b.findIndex((ch, k) => ch !== a[k]);
      console.log(`  tekst ${c.r.slug}: …${b.slice(Math.max(0, i - 30), i + 50).join("")}…`);
    }
  }
  if (!APPLY) { console.log("\nDry-run. Toepassen: geef een back-uppad en --apply."); return; }
  if (!BACKUP) throw new Error("Geef een back-uppad, bv. _sources/teksten-backup-2026-11-12.json");
  writeFileSync(BACKUP, JSON.stringify(changes.map((c) => ({ id: c.r.id, name: c.r.name, specs: c.r.specs, description: c.r.description })), null, 2));
  for (const c of changes) {
    await prisma.product.update({ where: { id: c.r.id }, data: { name: c.name, specs: c.specs, description: c.description } });
  }
  console.log(`✅ ${changes.length} producten bijgewerkt. Back-up: ${BACKUP}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
