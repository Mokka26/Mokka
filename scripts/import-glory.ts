// Import GLORY collectie — 13 producten. Beschrijvende Turkse namen
// (ASCII-veilige substrings) + sofa via modelcodes. Run: [--apply]

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

const BASE = path.join(process.cwd(), "_import-glory", "1 - Ürünler - Product",
  "1 - Yatak ve Yemek & Bedroom and Dining Room", "2025-GLORY");

type P = { slug: string; name: string; category: string; room: string; match: string[]; fabric?: boolean };
const PRODUCTS: P[] = [
  { slug: "glory-bed", name: "Glory Bed", category: "bedden", room: "YATAK", match: ["baza", "aplik", "başlık"] },
  { slug: "glory-kledingkast", name: "Glory Kledingkast", category: "kasten", room: "YATAK", match: ["dolap"] },
  { slug: "glory-nachtkastje", name: "Glory Nachtkastje", category: "kasten", room: "YATAK", match: ["komodin"] },
  { slug: "glory-ladekast", name: "Glory Ladekast", category: "kasten", room: "YATAK", match: ["amaş", "amas"] },
  { slug: "glory-commode", name: "Glory Commode", category: "kasten", room: "YATAK", match: ["ifonyer"] },
  { slug: "glory-dressoir", name: "Glory Dressoir", category: "kasten", room: "YEMEK", match: ["konsol"] },
  { slug: "glory-eettafel", name: "Glory Eettafel", category: "eettafels", room: "YEMEK", match: ["masas"] },
  { slug: "glory-eetkamerstoel", name: "Glory Eetkamerstoel", category: "stoelen", room: "YEMEK", match: ["sandalye"], fabric: true },
  { slug: "glory-salontafel", name: "Glory Salontafel", category: "salontafels", room: "YEMEK", match: ["orta sehpa"] },
  { slug: "glory-tv-meubel", name: "Glory Tv-meubel", category: "tv-meubels", room: "YEMEK", match: ["nitesi"] },
  { slug: "glory-bijzettafel", name: "Glory Bijzettafel", category: "bijzettafels", room: "YEMEK", match: ["zigon"] },
  { slug: "glory-bank", name: "Glory Bank", category: "bankstellen", room: "KOLTUK", fabric: true,
    match: ["5561","5562","5563","5564","5565","5566","5568","5569","5570","5571","5572","5573","5547","5549"] },
  { slug: "glory-fauteuil", name: "Glory Fauteuil", category: "bankstellen", room: "KOLTUK", fabric: true,
    match: ["5574","5575","5552"] },
];

function roomDir(room: string): string {
  const d = fs.readdirSync(BASE).find((x) => x.toUpperCase().includes(room));
  if (!d) throw new Error(`room niet gevonden: ${room}`);
  return path.join(BASE, d);
}
function matchFiles(dir: string, subs: string[]): string[] {
  const all = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f) && !/içi|ici|kopya/i.test(f) === false ? true : true);
  const imgs = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  const out: string[] = [];
  for (const sub of subs) for (const f of imgs) {
    if (f.toLowerCase().includes(sub.toLowerCase()) && !out.includes(f)) out.push(f);
  }
  return out;
}
function buildDesc(category: string, fabric: boolean, name: string): string {
  const t: Record<string, string> = {
    bedden: "Bed", kasten: "Kast", eettafels: "Eettafel", stoelen: "Eetkamerstoel",
    "tv-meubels": "Tv-meubel", salontafels: "Salontafel", bijzettafels: "Bijzettafel",
    bankstellen: name.includes("Fauteuil") ? "Fauteuil" : "Bank",
  };
  const type = t[category] ?? "Meubelstuk";
  const mat = fabric ? "Gestoffeerd in zachte stof met houten poten." : "Uitgevoerd in melamine (E1-spaanplaat) met houtdecor.";
  return `${type} uit de Glory-collectie in wit met houtdecor. ${mat} Levertijd: 2-4 weken.`;
}

async function main() {
  console.log(`\n═══ Import GLORY (${PRODUCTS.length}) ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");
  const plan: { p: P; files: string[] }[] = [];
  for (const p of PRODUCTS) {
    const files = matchFiles(roomDir(p.room), p.match);
    plan.push({ p, files });
    console.log(`  ${p.slug.padEnd(22)} [${p.category.padEnd(11)}] ${files.length}${files.length === 0 ? "  ⚠ GEEN" : ""}`);
  }
  if (!APPLY) { console.log("\nDry-run."); process.exit(0); }

  for (const { p, files } of plan) {
    if (!files.length) { console.log(`⏭ skip ${p.slug}`); continue; }
    const dir = roomDir(p.room);
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
      ? { Categorie: p.name.split(" ").slice(-1)[0], Serie: "GLORY", Materiaal: "Stof", Kleur: "Wit", Levertijd: "2-4 weken" }
      : { Categorie: p.name.split(" ").slice(-1)[0], Serie: "GLORY", Materiaal: "Melamine (E1 spaanplaat)", Afwerking: "Wit met houtdecor", Kleur: "Wit", Levertijd: "2-4 weken" };
    const data = { name: p.name, description: buildDesc(p.category, !!p.fabric, p.name), price: 0,
      category: p.category, images: JSON.stringify(images), specs: JSON.stringify(specs),
      colorName: "Wit", hidden: true, stock: 10 };
    const ex = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (ex) { await prisma.product.update({ where: { id: ex.id }, data }); console.log(` ✓ updated (${images.length})`); }
    else { await prisma.product.create({ data: { slug: p.slug, ...data } }); console.log(` ✓ created (${images.length})`); }
  }
  console.log(`\n✅ GLORY klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
