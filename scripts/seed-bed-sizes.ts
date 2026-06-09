// Zet standaard-maten (90/140/160/180 × 200) op bedden, elke maat op de
// HUIDIGE prijs van het bed (geen verzonnen prijzen). De maatkiezer verschijnt
// daarna op elke bedpagina; prijzen per maat pas je aan in de admin.
//
// Bedden die al een vaste maat in hun naam/slug hebben (bv. "140x200") worden
// overgeslagen — die zijn bewust één maat. Bedden die al maten hebben blijven
// ongemoeid (idempotent).
//
// Dry-run:  npx tsx scripts/seed-bed-sizes.ts
// Apply:    npx tsx scripts/seed-bed-sizes.ts --apply
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const SIZES = ["90 × 200", "140 × 200", "160 × 200", "180 × 200"];
// Detecteer een vaste maat in naam/slug, bv. "140x200", "90 × 200", "160x 200".
const HAS_FIXED_SIZE = /\d{2,3}\s*[x×]\s*\d{2,3}/i;

async function main() {
  const beds = await p.product.findMany({
    where: { category: "bedden", deletedAt: null },
    select: { id: true, slug: true, name: true, price: true, sizeVariants: true },
  });

  let seeded = 0;
  const skippedFixed: string[] = [];
  const skippedHasSizes: string[] = [];

  for (const b of beds) {
    if (b.sizeVariants && b.sizeVariants !== "null") { skippedHasSizes.push(b.slug); continue; }
    if (HAS_FIXED_SIZE.test(b.name) || HAS_FIXED_SIZE.test(b.slug)) { skippedFixed.push(b.slug); continue; }
    const variants = SIZES.map((label) => ({ label, price: b.price }));
    if (APPLY) {
      await p.product.update({ where: { id: b.id }, data: { sizeVariants: JSON.stringify(variants) } });
    }
    seeded++;
  }

  console.log(`\nBedden: ${beds.length}`);
  console.log(`→ maten gezet (4× ${SIZES.join(" / ")}): ${seeded}`);
  console.log(`→ overgeslagen (vaste maat in naam): ${skippedFixed.length}`);
  if (skippedFixed.length) console.log(`   ${skippedFixed.slice(0, 30).join(", ")}${skippedFixed.length > 30 ? " …" : ""}`);
  console.log(`→ overgeslagen (had al maten): ${skippedHasSizes.length}`);
  console.log(APPLY ? "\n✅ Toegepast." : "\n(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
