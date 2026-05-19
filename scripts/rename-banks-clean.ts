// Hernoem bank-producten naar schoon format: "Model Series Type"
//   - Strip parens (content blijft als spatie-gescheiden tekst)
//   - Type-woord ALTIJD aan einde (Hoekbank / Loungebank / U-Bank / Bank)
//   - Title Case
//
// Run:
//   npx tsx scripts/rename-banks-clean.ts             # dry-run
//   npx tsx scripts/rename-banks-clean.ts --apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const BANK_SLUGS = [
  "bolton-riviera-hoekbank", "california-kemer-hoekbank", "california-magic-hoekbank",
  "fortes-kemer-hoekbank", "jolly-kemer-hoekbank", "mila-monolith-hoekbank",
  "new-bolton-kronos-hoekbank", "new-bolton-riviera-hoekbank",
  "rafaello-relax-decowit-hoekbank", "rosso-soro-hoekbank", "star-kemer-hoekbank",
  "yola-monolith-hoekbank", "anna-hoekbank",
  "bonna-monolith-loungebank", "california-magic-loungebank", "rosso-soro-loungebank",
  "star-croco-loungebank", "star-preston-c-loungebank",
  "kingstone-genova-texarm-u-bank", "new-bolton-fresh-u-bank",
  "americano-bank", "anna-bank", "ares-bank", "ares-u-bank", "bella-bank",
  "clara-bank", "cloud-bank", "coast-lux-bank", "finn-bank", "moana-bank",
  "mystic-bank", "new-bolton-bank",
];

function cleanName(currentName: string, slug: string): string {
  let n = currentName.trim();
  // Strip parens, content blijft
  n = n.replace(/\s*\(([^)]+)\)\s*/g, " $1 ").replace(/\s+/g, " ").trim();

  // Detect + strip type-woord
  const types: { re: RegExp; label: string }[] = [
    { re: /\bhoekbank\b/i, label: "Hoekbank" },
    { re: /\bloungebank\b/i, label: "Loungebank" },
    { re: /\bu-?bank\b/i, label: "U-Bank" },
  ];
  let suffix: string | null = null;
  for (const t of types) {
    if (t.re.test(n)) {
      n = n.replace(t.re, "").trim();
      suffix = t.label;
      break;
    }
  }
  // Standaard "Bank" suffix wanneer slug op -bank eindigt en geen type-suffix
  if (!suffix && /-bank$/.test(slug)) {
    n = n.replace(/\bbank\b/i, "").trim();
    suffix = "Bank";
  }

  // Title Case (woord-grenzen, ook met hyphens)
  n = n.replace(/\s+/g, " ");
  n = n.replace(/\b([a-zA-ZÀ-ÿ])(\w*)/g, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
  return suffix ? `${n} ${suffix}` : n;
}

async function main() {
  console.log(`\n═══ Rename banks clean ═══`);
  console.log(`  Apply: ${APPLY ? "YES" : "no (dry-run)"}\n`);

  const products = await prisma.product.findMany({
    where: { slug: { in: BANK_SLUGS } },
    select: { id: true, slug: true, name: true, category: true },
  });

  const changes: { id: string; slug: string; from: string; to: string }[] = [];
  for (const p of products) {
    const proposed = cleanName(p.name, p.slug);
    if (proposed !== p.name) {
      changes.push({ id: p.id, slug: p.slug, from: p.name, to: proposed });
    }
  }

  console.log(`${changes.length} naam-wijzigingen:\n`);
  for (const c of changes) {
    console.log(`  ${c.slug}`);
    console.log(`    "${c.from}"`);
    console.log(`    "${c.to}"`);
  }

  if (!APPLY) { console.log(`\n[DRY-RUN]`); return; }

  for (const c of changes) {
    await prisma.product.update({ where: { id: c.id }, data: { name: c.to } });
  }
  console.log(`\n✓ ${changes.length} namen geupdate.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
