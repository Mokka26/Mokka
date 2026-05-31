// Sync Great Home producten met de bron (app4sales B2B-portaal).
// Bron-data is gescraped naar /tmp/gh_catalog.json (zie _gh_scrape).
// Per gematcht product (slug == slugify(GH-beschrijving)):
//   - prijs = lijstprijs ZONDER korting (SalesPriceWithoutDiscount) × 2.3, afgerond
//   - niet-op-voorraad (StockColor rood) → hidden=true
//   - source = "Great Home"
//   - ontbrekende afmeting aanvullen uit de beschrijving (alleen als leeg)
//
// Dry-run: npx tsx scripts/sync-greathome.ts
// Apply:   npx tsx scripts/sync-greathome.ts --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient();
import fs from "fs";

const APPLY = process.argv.includes("--apply");
const MARKUP = 2.3;
const CATALOG = "C:/Users/konia/AppData/Local/Temp/gh_catalog.json";

type GH = { code: string; desc: string; list: number; inStock: boolean };
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Probeer een nette afmeting uit de beschrijving te halen (conservatief).
function parseAfmeting(desc: string): string | null {
  const d = desc.replace(/,/g, ".");
  let m = d.match(/(\d{2,3})\s*[xX×]\s*(\d{2,3})\s*[xX×]\s*(\d{2,3})/); // LxBxH
  if (m) return `${m[1]} × ${m[2]} × ${m[3]} cm`;
  m = d.match(/(\d{2,3})\s*[xX×]\s*(\d{2,3})/); // LxB
  if (m) return `${m[1]} × ${m[2]} cm`;
  m = d.match(/[ØøΦ]\s*(\d{2,3})|(\d{2,3})\s*[ØøΦ]/); // diameter
  if (m) return `Ø ${m[1] || m[2]} cm`;
  return null;
}

async function main() {
  const gh: GH[] = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const bySlug = new Map<string, GH>();
  for (const g of gh) { const s = slugify(g.desc); if (!bySlug.has(s)) bySlug.set(s, g); }

  const prods = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, price: true, specs: true, hidden: true, source: true },
  });

  let matched = 0, priceChg = 0, toHide = 0, dimFilled = 0, retag = 0;
  const ops: { id: string; data: Record<string, unknown> }[] = [];
  for (const pr of prods) {
    const g = bySlug.get(pr.slug);
    if (!g) continue;
    matched++;
    const data: Record<string, unknown> = {};
    const newPrice = Math.round(g.list * MARKUP);
    if (newPrice !== pr.price) { data.price = newPrice; priceChg++; }
    if (!g.inStock && !pr.hidden) { data.hidden = true; toHide++; }
    if (pr.source !== "Great Home" && pr.source !== "LivingFurn" && pr.source !== "Rousseau") {
      data.source = "Great Home"; retag++;
    }
    // afmeting alleen aanvullen als leeg
    let specs: Record<string, string> = {};
    try { specs = JSON.parse(pr.specs || "{}"); } catch {}
    if (!specs.Afmetingen) {
      const af = parseAfmeting(g.desc);
      if (af) { specs.Afmetingen = af; data.specs = JSON.stringify(specs); dimFilled++; }
    }
    if (Object.keys(data).length) ops.push({ id: pr.id, data });
  }

  console.log(`\nGematcht met Great Home: ${matched}`);
  console.log(`  prijs gewijzigd:        ${priceChg}`);
  console.log(`  te verbergen (OOS):     ${toHide}`);
  console.log(`  source → Great Home:    ${retag}`);
  console.log(`  ontbrekende afmeting aangevuld: ${dimFilled}`);
  console.log(`  totaal te updaten:      ${ops.length}`);

  if (!APPLY) { console.log("\n(DRY-RUN — run met --apply)"); await prisma.$disconnect(); process.exit(0); }
  let done = 0;
  for (const op of ops) { await prisma.product.update({ where: { id: op.id }, data: op.data }); done++; }
  console.log(`\n✅ Toegepast op ${done} producten.`);
  await prisma.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
