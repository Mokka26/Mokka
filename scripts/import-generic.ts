// Generieke collectie-importer. Config per collectie in CONFIGS.
// Match per code (4-cijfer _DSF) of keyword (substring), 1 schoonste bestand per match.
//
// Run: npx tsx scripts/import-generic.ts --collection=marven-living [--apply]

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const COLL = process.argv.find((a) => a.startsWith("--collection="))?.split("=")[1];

type Prod = { slug: string; name: string; category: string; match: string[]; fabric?: boolean };
type Conf = { roomDir: string; serie: string; kleur: string; materiaalHard: string; products: Prod[] };

const CONFIGS: Record<string, Conf> = {
  "marven-living": {
    roomDir: "_import-marven/1 - Ürünler - Product/1 - Yatak ve Yemek & Bedroom and Dining Room/2026 - MARVEN/YAŞAM ODASI - LIVING ROOM",
    serie: "MARVEN", kleur: "Walnoot", materiaalHard: "Melamine (E1 spaanplaat) met marmerblad",
    products: [
      { slug: "marven-dressoir", name: "Marven Dressoir", category: "kasten", match: ["0433","0434","0435","0443","0444","0445"] },
      { slug: "marven-eettafel", name: "Marven Eettafel", category: "eettafels", match: ["0447","0448","0450"] },
      { slug: "marven-eetkamerstoel", name: "Marven Eetkamerstoel", category: "stoelen", fabric: true, match: ["0454","0455","0456"] },
      { slug: "marven-tv-meubel", name: "Marven Tv-meubel", category: "tv-meubels", match: ["0588","0591","0599"] },
      { slug: "marven-salontafel", name: "Marven Salontafel", category: "salontafels", match: ["0593","0595","0596","0597","0627","0628"] },
      { slug: "marven-bank", name: "Marven Bank", category: "bankstellen", fabric: true, match: ["0605","0610","0611","0615"] },
      { slug: "marven-fauteuil", name: "Marven Fauteuil", category: "bankstellen", fabric: true, match: ["0616","0618","0621"] },
    ],
  },
  "soprano-living": {
    roomDir: "_import-soprano/1 - Ürünler - Product/1 - Yatak ve Yemek & Bedroom and Dining Room/2026 - SOPRANO/YAŞAM ODASI - LIVING ROOM",
    serie: "SOPRANO", kleur: "Crème", materiaalHard: "Melamine (E1 spaanplaat) met marmerblad",
    products: [
      { slug: "soprano-dressoir", name: "Soprano Dressoir", category: "kasten", match: ["0501","0503","0508","0514","0516","0517"] },
      { slug: "soprano-eettafel", name: "Soprano Eettafel", category: "eettafels", match: ["0511","0522","0523","0526"] },
      { slug: "soprano-eetkamerstoel", name: "Soprano Eetkamerstoel", category: "stoelen", fabric: true, match: ["0527","0528","0529"] },
      { slug: "soprano-tv-meubel", name: "Soprano Tv-meubel", category: "tv-meubels", match: ["0575","0577","0579","0580"] },
      { slug: "soprano-salontafel", name: "Soprano Salontafel", category: "salontafels", match: ["0512","0578","0581"] },
      { slug: "soprano-bank", name: "Soprano Bank", category: "bankstellen", fabric: true, match: ["0545","0548","0558","0560","0553"] },
      { slug: "soprano-fauteuil", name: "Soprano Fauteuil", category: "bankstellen", fabric: true, match: ["0562","0563","0564"] },
    ],
  },
};

function fileForMatch(imgs: string[], m: string): string | null {
  const hits = imgs.filter((f) => f.toLowerCase().includes(m.toLowerCase())).sort((a, b) => a.length - b.length);
  return hits[0] ?? null;
}
function matchFiles(dir: string, matches: string[]): string[] {
  const imgs = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  const out: string[] = [];
  for (const m of matches) { const f = fileForMatch(imgs, m); if (f && !out.includes(f)) out.push(f); }
  return out;
}
function desc(category: string, fabric: boolean, serie: string, name: string, matHard: string): string {
  const t: Record<string, string> = {
    bedden: "Bed", kasten: "Kast", eettafels: "Eettafel", stoelen: "Eetkamerstoel",
    "tv-meubels": "Tv-meubel", salontafels: "Salontafel", bijzettafels: "Bijzettafel",
    spiegels: "Spiegel", slaapkamers: "Kaptafel", hoekbanken: "Hoekbank",
    bankstellen: name.includes("Fauteuil") ? "Fauteuil" : "Bank",
  };
  const type = t[category] ?? "Meubelstuk";
  const mat = fabric ? "Gestoffeerd in zachte stof met houten poten." : `Uitgevoerd in ${matHard.toLowerCase()}.`;
  return `${type} uit de ${serie.charAt(0)}${serie.slice(1).toLowerCase()}-collectie. ${mat} Levertijd: 2-4 weken.`;
}

async function main() {
  if (!COLL || !CONFIGS[COLL]) { console.error(`Onbekende collectie. Opties: ${Object.keys(CONFIGS).join(", ")}`); process.exit(1); }
  const c = CONFIGS[COLL];
  const dir = path.join(process.cwd(), c.roomDir);
  console.log(`\n═══ Import ${COLL} (${c.products.length}) ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");
  if (!fs.existsSync(dir)) { console.error(`❌ map niet gevonden: ${dir}`); process.exit(1); }

  const plan = c.products.map((p) => ({ p, files: matchFiles(dir, p.match) }));
  for (const { p, files } of plan)
    console.log(`  ${p.slug.padEnd(24)} [${p.category.padEnd(11)}] ${files.length}/${p.match.length}`);
  if (!APPLY) { console.log("\nDry-run."); process.exit(0); }

  for (const { p, files } of plan) {
    if (!files.length) { console.log(`⏭ skip ${p.slug}`); continue; }
    console.log(`\n📦 ${p.slug}`);
    const images: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const pid = `mokka/${p.category}/${p.slug}/${String(i + 1).padStart(2, "0")}`;
      try {
        const r = await cloudinary.uploader.upload(path.join(dir, files[i]), {
          public_id: pid, overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
        });
        images.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch (e) { console.error(`\n  ✗ ${files[i]}: ${e instanceof Error ? e.message : e}`); }
    }
    const specs = p.fabric
      ? { Categorie: p.name.split(" ").slice(-1)[0], Serie: c.serie, Materiaal: "Stof", Kleur: c.kleur, Levertijd: "2-4 weken" }
      : { Categorie: p.name.split(" ").slice(-1)[0], Serie: c.serie, Materiaal: c.materiaalHard, Kleur: c.kleur, Levertijd: "2-4 weken" };
    const data = { name: p.name, description: desc(p.category, !!p.fabric, c.serie, p.name, c.materiaalHard),
      price: 0, category: p.category, images: JSON.stringify(images), specs: JSON.stringify(specs),
      colorName: c.kleur, hidden: true, stock: 10 };
    const ex = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (ex) { await prisma.product.update({ where: { id: ex.id }, data }); console.log(` ✓ updated (${images.length})`); }
    else { await prisma.product.create({ data: { slug: p.slug, ...data } }); console.log(` ✓ created (${images.length})`); }
  }
  console.log(`\n✅ ${COLL} klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
