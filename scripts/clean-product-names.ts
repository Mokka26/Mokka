// Schoon onhandige product-namen op:
//   - underscores → spatie + capitalize: "Relax_decowit" → "Relax Decowit"
//   - all-caps brand: "TEXARM" → "Texarm"
//   - parens-zonder-spatie issue
//
// Run:
//   npx tsx scripts/clean-product-names.ts             # dry-run
//   npx tsx scripts/clean-product-names.ts --apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

function titleCase(s: string): string {
  return s.replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
}

function cleanName(name: string): string {
  let n = name;
  // Vervang underscores binnen parens met spaties: "(Relax_decowit)" → "(Relax decowit)"
  n = n.replace(/_/g, " ");
  // Caps die >3 letters zijn → title case (TEXARM, KEMER, CROCO blijven brand)
  // Maar in onze data zijn dit codewoorden — beter title-case alleen binnen parens
  n = n.replace(/\(([^)]+)\)/g, (_, inner: string) => `(${titleCase(inner)})`);
  // Dubbele spaties weg
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

async function main() {
  console.log(`\n═══ Clean product names ═══\n  Apply: ${APPLY ? "YES" : "no (dry-run)"}\n`);

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: "_" } },
        { name: { contains: "TEXARM" } },
        { name: { contains: "(" } },
      ],
    },
    select: { id: true, slug: true, name: true },
  });

  const changes: { id: string; slug: string; from: string; to: string }[] = [];
  for (const p of products) {
    const cleaned = cleanName(p.name);
    if (cleaned !== p.name) {
      changes.push({ id: p.id, slug: p.slug, from: p.name, to: cleaned });
    }
  }

  console.log(`${changes.length} namen wijzigen:`);
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
