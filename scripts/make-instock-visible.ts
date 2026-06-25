// Maakt alle verborgen producten die OP VOORRAAD zijn (stock > 0) zichtbaar.
// Uitverkochte (stock 0) blijven verborgen. €0-producten worden zichtbaar en
// tonen "Prijs op aanvraag" tot ze geprijsd zijn.
//
// Dry-run: npx tsx scripts/make-instock-visible.ts
// Apply:   npx tsx scripts/make-instock-visible.ts --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const where = { hidden: true, deletedAt: null, stock: { gt: 0 } };
  const target = await p.product.findMany({ where, select: { source: true, price: true } });
  const oos = await p.product.count({ where: { hidden: true, deletedAt: null, stock: { lte: 0 } } });

  const bySrc: Record<string, { n: number; p0: number }> = {};
  for (const t of target) { const b = (bySrc[t.source || "(geen)"] ??= { n: 0, p0: 0 }); b.n++; if (t.price <= 0) b.p0++; }
  console.log(`\nZichtbaar te maken (op voorraad): ${target.length}`);
  for (const [s, b] of Object.entries(bySrc).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${s.padEnd(16)} ${b.n}  (waarvan €0 → "Prijs op aanvraag": ${b.p0})`);
  console.log(`Blijven verborgen (uitverkocht): ${oos}`);

  if (APPLY) {
    const r = await p.product.updateMany({ where, data: { hidden: false } });
    console.log(`\n✅ ${r.count} producten zichtbaar gemaakt.`);
  } else console.log("\n(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
