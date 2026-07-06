// Splitst het foute combi-product 'puf-pouf-jeugdkamer' (12 verschillende
// poefs/items in één product) op in losse producten. Poefs → categorie 'poefs',
// de fauteuil → 'fauteuils'. De sfeerfoto (laatste) wordt overgeslagen.
// Nieuw = verborgen + €0 (naam/prijs later). Origineel → prullenbak.
//
// Dry-run: npx tsx scripts/split-puf-pouf.ts   Apply: --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// idx = index in de images-array (zie montage). Naam = beschrijvende placeholder.
const MAP: { idx: number; slug: string; name: string; cat: string }[] = [
  { idx: 0,  slug: "poef-boucle-grijs",        name: "Poef bouclé grijs",         cat: "poefs" },
  { idx: 1,  slug: "poef-getuft-grijs",        name: "Poef getuft grijs",         cat: "poefs" },
  { idx: 2,  slug: "fauteuil-boucle-cognac",   name: "Fauteuil bouclé cognac",    cat: "fauteuils" },
  { idx: 3,  slug: "poef-ruitpatroon",         name: "Poef ruitpatroon",          cat: "poefs" },
  { idx: 4,  slug: "zitbankje-velours",        name: "Zitbankje velours",         cat: "poefs" },
  { idx: 5,  slug: "poef-ruitpatroon-blauw",   name: "Poef ruitpatroon blauw",    cat: "poefs" },
  { idx: 6,  slug: "poef-fluweel-terracotta",  name: "Poef fluweel terracotta",   cat: "poefs" },
  { idx: 7,  slug: "poef-boucle-grijs-poten",  name: "Poef bouclé grijs met poten", cat: "poefs" },
  { idx: 8,  slug: "poef-boucle-oker",         name: "Poef bouclé oker",          cat: "poefs" },
  { idx: 9,  slug: "poef-boucle-wit",          name: "Poef bouclé wit",           cat: "poefs" },
  { idx: 10, slug: "poef-boucle-creme",        name: "Poef bouclé crème",         cat: "poefs" },
  // idx 11 = sfeerfoto → overslaan
];

async function main() {
  const src = await p.product.findFirst({ where: { slug: { contains: "puf" }, deletedAt: null } });
  if (!src) { console.log("Bron-product niet gevonden."); return; }
  const imgs = JSON.parse(src.images) as { url: string; w: number; h: number }[];
  console.log(`Bron: ${src.slug} (${imgs.length} foto's) → ${MAP.length} losse producten\n`);

  for (const m of MAP) {
    const img = imgs[m.idx];
    if (!img) { console.log(`  ⚠ idx ${m.idx} ontbreekt — ${m.slug}`); continue; }
    console.log(`  ${m.slug.padEnd(28)} [${m.cat}]  "${m.name}"`);
    if (APPLY) {
      const data = {
        name: m.name,
        description: `${m.name}. Losse ${m.cat === "poefs" ? "poef" : "fauteuil"} uit de collectie. Prijs op aanvraag.`,
        price: 0, category: m.cat,
        images: JSON.stringify([img]),
        specs: JSON.stringify({ Categorie: m.cat === "poefs" ? "Poef" : "Fauteuil" }),
        source: "Mokka catalogus", hidden: true, stock: 10,
      };
      await p.product.upsert({ where: { slug: m.slug }, update: data, create: { slug: m.slug, ...data } });
    }
  }

  if (APPLY) {
    await p.product.update({ where: { id: src.id }, data: { deletedAt: new Date() } });
    console.log(`\n✅ ${MAP.length} losse producten aangemaakt (verborgen). Origineel '${src.slug}' → prullenbak.`);
  } else {
    console.log("\n(DRY-RUN — run met --apply)");
  }
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
