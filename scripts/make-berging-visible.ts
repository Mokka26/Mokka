// Maakt de geïmporteerde Rousseau-berging zichtbaar met een TIJDELIJKE
// placeholderprijs (schoenenkasten €199, kapstokken €99). Raakt alleen de
// eigen import aan: source 'Rousseau' + price 0. Vervang prijzen later in admin.
//
// Dry-run:  npx tsx scripts/make-berging-visible.ts
// Apply:    npx tsx scripts/make-berging-visible.ts --apply
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const PLACEHOLDER: Record<string, number> = {
  schoenenkasten: 199,
  kapstokken: 99,
};

async function main() {
  const rows = await p.product.findMany({
    where: { source: "Rousseau", category: { in: ["schoenenkasten", "kapstokken"] }, price: 0, deletedAt: null },
    select: { id: true, slug: true, category: true, hidden: true },
  });
  console.log(`\n${rows.length} producten (${APPLY ? "APPLY" : "dry-run"})\n`);
  for (const r of rows) {
    const price = PLACEHOLDER[r.category] ?? 0;
    console.log(`  zichtbaar · €${price}  ${r.slug}`);
    if (APPLY) await p.product.update({ where: { id: r.id }, data: { hidden: false, price } });
  }
  console.log(APPLY ? "\n✅ Zichtbaar met placeholderprijs (vervang in admin)." : "\n(dry-run — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
