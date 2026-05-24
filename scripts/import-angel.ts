// Import ANGEL collectie — 14 producten. Gebruikt beschrijvende Turkse
// bestandsnamen (substring-match) voor slaapkamer/eetkamer; sofa via modelcodes.
// Hidden, placeholder-prijs. Run: npx tsx scripts/import-angel.ts [--apply]

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

const BASE = path.join(process.cwd(), "_import-angel", "1 - Ürünler - Product",
  "1 - Yatak ve Yemek & Bedroom and Dining Room", "2025-ANGEL");

// product: slug, naam, categorie, room, match (substrings, lowercase), fabric?
type P = { slug: string; name: string; category: string; room: string; match: string[]; fabric?: boolean };
const PRODUCTS: P[] = [
  // SLAAPKAMER
  { slug: "angel-bed", name: "Angel Bed", category: "bedden", room: "YATAK", match: ["baza", "başlık", "yatak odası"] },
  { slug: "angel-kledingkast", name: "Angel Kledingkast", category: "kasten", room: "YATAK", match: ["gardrop"] },
  { slug: "angel-commode", name: "Angel Commode", category: "kasten", room: "YATAK", match: ["dresser"] },
  { slug: "angel-nachtkastje", name: "Angel Nachtkastje", category: "kasten", room: "YATAK", match: ["komodin"] },
  { slug: "angel-ladekast", name: "Angel Ladekast", category: "kasten", room: "YATAK", match: ["çamaşırlık", "camasirlik"] },
  // EETKAMER
  { slug: "angel-dressoir", name: "Angel Dressoir", category: "kasten", room: "YEMEK", match: ["konsol"] },
  { slug: "angel-eettafel", name: "Angel Eettafel", category: "eettafels", room: "YEMEK", match: ["masa"] },
  { slug: "angel-eetkamerstoel", name: "Angel Eetkamerstoel", category: "stoelen", room: "YEMEK", match: ["sandalye"], fabric: true },
  { slug: "angel-salontafel", name: "Angel Salontafel", category: "salontafels", room: "YEMEK", match: ["orta sehpa"] },
  { slug: "angel-tv-meubel", name: "Angel Tv-meubel", category: "tv-meubels", room: "YEMEK", match: ["tv sehpa", "tvsehpa"] },
  { slug: "angel-bijzettafel", name: "Angel Bijzettafel", category: "bijzettafels", room: "YEMEK", match: ["zigon"] },
  // BANK (modelcodes)
  { slug: "angel-bank", name: "Angel Bank", category: "bankstellen", room: "KOLTUK", fabric: true,
    match: ["5538", "5539", "5542", "5523", "5525", "5527", "5536", "5510", "5513", "5515", "5522", "5533", "5541"] },
  { slug: "angel-fauteuil", name: "Angel Fauteuil", category: "bankstellen", room: "KOLTUK", fabric: true, match: ["5545"] },
];

function roomDir(room: string): string {
  const d = fs.readdirSync(BASE).find((x) => x.toUpperCase().includes(room));
  if (!d) throw new Error(`room niet gevonden: ${room}`);
  return path.join(BASE, d);
}

function matchFiles(dir: string, subs: string[]): string[] {
  const all = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  const out: string[] = [];
  for (const sub of subs) {
    for (const f of all) {
      if (f.toLowerCase().includes(sub.toLowerCase()) && !out.includes(f)) out.push(f);
    }
  }
  return out;
}

function buildDesc(category: string, fabric: boolean, name: string): string {
  const t: Record<string, string> = {
    bedden: "Bed", kasten: "Kast", eettafels: "Eettafel", stoelen: "Eetkamerstoel",
    "tv-meubels": "Tv-meubel", salontafels: "Salontafel", bijzettafels: "Bijzettafel",
    bankstellen: name.includes("Fauteuil") ? "Fauteuil" : "Bank", slaapkamers: "Kaptafel",
  };
  const type = t[category] ?? "Meubelstuk";
  const mat = fabric ? "Gestoffeerd in zachte stof met houten poten." : "Uitgevoerd in melamine (E1-spaanplaat) met houtdecor.";
  return `${type} uit de Angel-collectie in crème met houtdecor. ${mat} Levertijd: 2-4 weken.`;
}

async function main() {
  console.log(`\n═══ Import ANGEL (${PRODUCTS.length} producten) ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const plan: { p: P; files: string[] }[] = [];
  for (const p of PRODUCTS) {
    const dir = roomDir(p.room);
    const files = matchFiles(dir, p.match);
    plan.push({ p, files });
    console.log(`  ${p.slug.padEnd(22)} [${p.category.padEnd(11)}] ${files.length} foto's`);
    if (files.length === 0) console.log(`    ⚠ GEEN match voor: ${p.match.join(", ")}`);
  }

  if (!APPLY) { console.log("\nDry-run. Run met --apply."); process.exit(0); }

  for (const { p, files } of plan) {
    if (files.length === 0) { console.log(`\n⏭  skip ${p.slug} (geen foto's)`); continue; }
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
      ? { Categorie: p.name.split(" ").slice(-1)[0], Serie: "ANGEL", Materiaal: "Stof", Kleur: "Crème", Levertijd: "2-4 weken" }
      : { Categorie: p.name.split(" ").slice(-1)[0], Serie: "ANGEL", Materiaal: "Melamine (E1 spaanplaat)", Afwerking: "Crème met houtdecor", Kleur: "Crème", Levertijd: "2-4 weken" };
    const data = {
      name: p.name, description: buildDesc(p.category, !!p.fabric, p.name),
      price: 0, category: p.category, images: JSON.stringify(images),
      specs: JSON.stringify(specs), colorName: "Crème", hidden: true, stock: 10,
    };
    const ex = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (ex) { await prisma.product.update({ where: { id: ex.id }, data }); console.log(` ✓ updated (${images.length})`); }
    else { await prisma.product.create({ data: { slug: p.slug, ...data } }); console.log(` ✓ created (${images.length})`); }
  }
  console.log(`\n✅ ANGEL klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
