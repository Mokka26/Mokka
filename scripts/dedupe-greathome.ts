// Ruimt dubbele-naam producten op (na de Great Home sync):
//  - echte junk-duplicaten (collisie -1/-2 slug, 0 foto's, kapotte €240-import) → hidden
//  - echte varianten met per ongeluk identieke naam → naam onderscheiden
// Dry-run default; --apply om door te voeren.
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Junk-kopieën verbergen (sibling met betere data blijft zichtbaar)
const HIDE = [
  "kimberly-ext-dt-160-200x90x75-black-veneer-plain-1",   // dup, kapotte €240
  "ceiling-lamp-ql10637-1-3160-600-gold",                 // -1 collisie-dup
  "ceiling-lamp-ql10638-1-3160-600-silver",               // -1 collisie-dup
  "nirvana-2-bankstel",                                   // dup (2 vs 11 foto's)
  "voyance-2-bankstel",                                   // dup (0 foto's)
  "chair-alenya-zb-5620-black-legs-light-grey-2110-19",   // dup van lichtgrijs (-16)
  "chair-baroni-zb-5686-grey-fy2415-10",                  // dup (identiek aan -grey)
  "chair-dubai-zb-5576-l-brown-legs-fy2415-6-taupe",      // dup (identiek aan -brown-legs)
];

// Echte varianten → onderscheidende naam (slug blijft, alleen display-naam)
const RENAME: Record<string, string> = {
  "taksim-ct-blocci-100-flintstone-faux-marble-top": "Taksim Salontafel Ø 100 Flintstone Marmer Blocci",
  "new-organic-curve-dt-200x110-oval-white": "New Organic Eettafel 200×110 Wit Curve",
  "fox-black-brown-flintstone-faux-marble-top": "Fox Tafelblad Zwart-Bruin Marmer",
  "kimberly-et-blocci-55-flintstone-faux-marble-top": "Kimberly Bijzettafel Ø 55 Flintstone Marmer Blocci",
  "royal-dinning-table-oval-200x100x76-black-veneer-plain": "Royal Eettafel 200×100×76 Zwart Fineer Ovaal",
  "royal-coffee-table-oval-140x80x45-black-veneer-plain": "Royal Salontafel 140×80×45 Zwart Fineer Ovaal",
  "decoration-inhh-10014-hurricane-with-lamp-small-black-gold": "Sfeerlamp Zwart 10014 Klein",
  "decoration-inhh-10014-hurricane-with-lamp-large-black-gold": "Sfeerlamp Zwart 10014 Groot",
  "ceiling-lamp-056-540-black": "Plafondlamp Zwart 056-540",
  "ceiling-lamp-056-750-black": "Plafondlamp Zwart 056-750",
  "feather-gh1754-b058-1200-wall-led-lamp-gold-white": "Feather Lamp Goud-wit GH1754",
  "chair-alenya-zb-5620-black-legs-dark-grey-2110-22": "Alenya ZB-5620 Eetkamerstoel Zwart onderstel Donkergrijs",
  "chair-alenya-zb-5620-black-legs-light-grey-2110-16": "Alenya ZB-5620 Eetkamerstoel Zwart onderstel Lichtgrijs",
};

async function main() {
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");
  let hidden = 0, renamed = 0, missing = 0;
  console.log("— Verbergen (junk-duplicaten) —");
  for (const slug of HIDE) {
    const pr = await prisma.product.findUnique({ where: { slug }, select: { id: true, hidden: true, name: true } });
    if (!pr) { console.log(`  ⚠ niet gevonden: ${slug}`); missing++; continue; }
    console.log(`  ${pr.hidden ? "(al verborgen)" : "verberg"}  ${slug}`);
    if (APPLY && !pr.hidden) { await prisma.product.update({ where: { id: pr.id }, data: { hidden: true } }); hidden++; }
  }
  console.log("\n— Hernoemen (echte varianten) —");
  for (const [slug, name] of Object.entries(RENAME)) {
    const pr = await prisma.product.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!pr) { console.log(`  ⚠ niet gevonden: ${slug}`); missing++; continue; }
    console.log(`  "${pr.name}" → "${name}"`);
    if (APPLY) { await prisma.product.update({ where: { id: pr.id }, data: { name } }); renamed++; }
  }
  console.log(`\n${APPLY ? "Toegepast" : "Dry-run"}: ${APPLY ? hidden : HIDE.length} verborgen, ${APPLY ? renamed : Object.keys(RENAME).length} hernoemd${missing ? `, ${missing} niet gevonden` : ""}`);
  await prisma.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
