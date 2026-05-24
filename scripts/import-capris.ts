// Import CAPRIS collectie — 13 producten over slaapkamer/eetkamer/bank.
// Hidden, placeholder-prijs, foto's → Cloudinary. User curate via /admin.
//
// Run: npx tsx scripts/import-capris.ts [--apply]

import { config } from "dotenv";
config({ path: ".env.local" });
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

const BASE = path.join(process.cwd(), "_import-capris", "1 - Ürünler - Product",
  "1 - Yatak ve Yemek & Bedroom and Dining Room", "2024 - CAPRIS");
const F = (n: string) => `NEVİ_${n}.jpg`;

type P = { slug: string; name: string; category: string; room: string; files: string[]; fabric?: boolean };

const PRODUCTS: P[] = [
  // SLAAPKAMER (YATAK)
  { slug: "capris-bed", name: "Capris Bed", category: "bedden", room: "YATAK",
    files: [F("129384"), F("129385"), F("129386"), F("129387"), F("129388"), F("129361"), F("129362"), F("129383")] },
  { slug: "capris-kledingkast", name: "Capris Kledingkast", category: "kasten", room: "YATAK",
    files: [F("129363"), F("129366"), "NEVİ_129366-BEYAZ.jpg", F("129368"), F("129390"), F("129395"), F("129391"), F("129394")] },
  { slug: "capris-commode", name: "Capris Commode", category: "kasten", room: "YATAK",
    files: [F("129373"), F("129375"), F("129372")] },
  { slug: "capris-nachtkastje", name: "Capris Nachtkastje", category: "kasten", room: "YATAK",
    files: [F("129389"), F("129376"), F("129371")] },
  { slug: "capris-ladekast", name: "Capris Ladekast", category: "kasten", room: "YATAK",
    files: [F("129380"), F("129382"), F("129381")] },
  { slug: "capris-kaptafel", name: "Capris Kaptafel", category: "slaapkamers", room: "YATAK",
    files: [F("129377")] },

  // EETKAMER (YEMEK)
  { slug: "capris-dressoir", name: "Capris Dressoir", category: "kasten", room: "YEMEK",
    files: [F("129409"), F("129410"), F("129416"), F("129414"), F("129415"), F("129408")] },
  { slug: "capris-eettafel", name: "Capris Eettafel", category: "eettafels", room: "YEMEK",
    files: [F("129417"), F("129418"), F("129412"), F("129411"), F("129413"), F("129419")] },
  { slug: "capris-eetkamerstoel", name: "Capris Eetkamerstoel", category: "stoelen", room: "YEMEK", fabric: true,
    files: [F("129420")] },
  { slug: "capris-tv-meubel", name: "Capris Tv-meubel", category: "tv-meubels", room: "YEMEK",
    files: [F("129422"), F("129424"), F("129426")] },
  { slug: "capris-salontafel", name: "Capris Salontafel", category: "salontafels", room: "YEMEK",
    files: [F("129427"), F("129428"), F("129448"), F("129425")] },

  // BANK (KOLTUK)
  { slug: "capris-bank", name: "Capris Bank", category: "bankstellen", room: "KOLTUK", fabric: true,
    files: [F("129442"), F("129443"), F("129436"), F("129437"), F("129440"), F("129441"), F("129430"), F("129432")] },
  { slug: "capris-fauteuil", name: "Capris Fauteuil", category: "bankstellen", room: "KOLTUK", fabric: true,
    files: [F("129444"), F("129446"), F("129438"), F("129447")] },
];

function roomDir(room: string): string {
  const dirs = fs.readdirSync(BASE).filter((d) => d.includes(room));
  return path.join(BASE, dirs[0]);
}

function buildDesc(name: string, category: string, fabric: boolean): string {
  const typeMap: Record<string, string> = {
    bedden: "Bed", kasten: "Kast", slaapkamers: "Kaptafel", eettafels: "Eettafel",
    stoelen: "Eetkamerstoel", "tv-meubels": "Tv-meubel", salontafels: "Salontafel",
    bankstellen: name.includes("Fauteuil") ? "Fauteuil" : "Bank",
  };
  const type = typeMap[category] ?? "Meubelstuk";
  const mat = fabric ? "Gestoffeerd in zachte stof met houten poten." : "Uitgevoerd in melamine (E1-spaanplaat) met houtdecor.";
  return `${type} uit de Capris-collectie in wit met houtdecor. ${mat} Levertijd: 2-4 weken.`;
}

async function main() {
  console.log(`\n═══ Import CAPRIS (${PRODUCTS.length} producten) ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  // Valideer files
  let bad = 0;
  for (const p of PRODUCTS) {
    const dir = roomDir(p.room);
    for (const f of p.files) {
      if (!fs.existsSync(path.join(dir, f))) { console.error(`  ⚠ ${p.slug}: mist ${f}`); bad++; }
    }
  }
  if (bad > 0) { console.error(`\n${bad} ontbrekende bestanden. Stop.`); process.exit(1); }

  for (const p of PRODUCTS) console.log(`  ${p.slug.padEnd(24)} [${p.category.padEnd(11)}] ${p.files.length} foto's`);

  if (!APPLY) { console.log("\nDry-run. Run met --apply."); process.exit(0); }

  for (const p of PRODUCTS) {
    const dir = roomDir(p.room);
    console.log(`\n📦 ${p.slug}`);
    const images: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < p.files.length; i++) {
      const pid = `mokka/${p.category}/${p.slug}/${String(i + 1).padStart(2, "0")}`;
      try {
        const r = await cloudinary.uploader.upload(path.join(dir, p.files[i]), {
          public_id: pid, overwrite: true, resource_type: "image",
          quality: "auto:best", fetch_format: "auto",
        });
        images.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch (e) { console.error(`\n  ✗ ${p.files[i]}: ${e instanceof Error ? e.message : e}`); }
    }
    const specs = p.fabric
      ? { Categorie: p.name.split(" ").slice(-1)[0], Serie: "CAPRIS", Materiaal: "Stof", Kleur: "Beige", Levertijd: "2-4 weken" }
      : { Categorie: p.name.split(" ").slice(-1)[0], Serie: "CAPRIS", Materiaal: "Melamine (E1 spaanplaat)", Afwerking: "Wit met houtdecor", Kleur: "Wit", Levertijd: "2-4 weken" };
    const data = {
      name: p.name, description: buildDesc(p.name, p.category, !!p.fabric),
      price: 0, category: p.category, images: JSON.stringify(images),
      specs: JSON.stringify(specs), colorName: p.fabric ? "Beige" : "Wit",
      hidden: true, stock: 10,
    };
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (existing) { await prisma.product.update({ where: { id: existing.id }, data }); console.log(` ✓ updated`); }
    else { await prisma.product.create({ data: { slug: p.slug, ...data } }); console.log(` ✓ created`); }
  }
  console.log(`\n✅ ${PRODUCTS.length} CAPRIS-producten hidden in DB.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
