/**
 * Zet de voorraad van zichtbare producten die op "uitverkocht" staan
 * (stock <= 0) op een vaste waarde. Verborgen en verwijderde producten blijven
 * onaangeroerd; die staan toch niet in de shop.
 *
 *   npx tsx scripts/restock-soldout.ts            # dry-run: toont welke producten
 *   npx tsx scripts/restock-soldout.ts --apply    # schrijft stock = 10
 *   npx tsx scripts/restock-soldout.ts --to=25    # andere waarde
 *
 * Let op: listings staan in een cache (tag "products", max 1 uur). Na een
 * deploy is alles vers; lokaal zie je het na een herstart van de dev-server.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TO = Number(args.find((a) => a.startsWith("--to="))?.slice(5) ?? 10);

async function main() {
  if (!Number.isInteger(TO) || TO <= 0) throw new Error(`Ongeldige --to waarde: ${TO}`);
  const products = await prisma.product.findMany({
    where: { deletedAt: null, hidden: false, stock: { lte: 0 } },
    select: { id: true, slug: true, category: true, name: true, stock: true },
    orderBy: [{ category: "asc" }, { slug: "asc" }],
  });
  for (const p of products) console.log(`  ${p.category}/${p.slug}  (${p.stock} → ${TO})`);
  console.log(`\n${products.length} zichtbare producten op uitverkocht.`);
  if (!APPLY) {
    console.log("DRY-RUN (gebruik --apply om weg te schrijven)");
    return;
  }
  const res = await prisma.product.updateMany({
    where: { id: { in: products.map((p) => p.id) } },
    data: { stock: TO },
  });
  console.log(`TOEGEPAST: ${res.count} producten op voorraad ${TO}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
