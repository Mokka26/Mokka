// Import CREA collectie — 5 slaapkamer-producten. Raw _DSF-fotonamen,
// vision-geïdentificeerd → hardcoded code-lijsten. Dedup "- Kopya" Windows-copies.
// Run: [--apply]

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

const ROOM = path.join(process.cwd(), "_import-crea", "1 - Ürünler - Product",
  "1 - Yatak ve Yemek & Bedroom and Dining Room", "2026 - CREA", "YATAK ODASI - BEDROOM");

type P = { slug: string; name: string; category: string; codes: string[] };
const PRODUCTS: P[] = [
  { slug: "crea-bed", name: "Crea Bed", category: "bedden",
    codes: ["DSF0218", "DSF0221", "DSF0228", "DSF0680", "DSF0681", "DSF0188", "DSF0192", "DSF0219"] },
  { slug: "crea-kledingkast", name: "Crea Kledingkast", category: "kasten",
    codes: ["DSF0179", "DSF0182", "DSF0164", "DSF0166", "DSF0185", "DSF0173"] },
  { slug: "crea-kaptafel", name: "Crea Kaptafel", category: "slaapkamers",
    codes: ["DSF0210", "DSF0211", "DSF0212", "DSF0195", "DSF0205"] },
  { slug: "crea-nachtkastje", name: "Crea Nachtkastje", category: "kasten",
    codes: ["DSF0232", "DSF0233", "DSF0234", "DSF0209"] },
  { slug: "crea-ladekast", name: "Crea Ladekast", category: "kasten",
    codes: ["DSF0242", "DSF0243"] },
];

function matchFiles(codes: string[]): string[] {
  const imgs = fs.readdirSync(ROOM).filter((f) =>
    /\.(jpg|jpeg|png)$/i.test(f) && !/- kopya/i.test(f)); // skip Windows-copy dupes
  const out: string[] = [];
  for (const code of codes) {
    const hit = imgs.find((f) => f.toUpperCase().includes(code.toUpperCase()));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

function buildDesc(category: string, name: string): string {
  const t: Record<string, string> = {
    bedden: "Bed", kasten: "Kast", slaapkamers: "Kaptafel",
  };
  const type = t[category] ?? "Meubelstuk";
  return `${type} uit de Crea-collectie in wit met licht houtdecor en LED-verlichting. Uitgevoerd in melamine (E1-spaanplaat). Levertijd: 2-4 weken.`;
}

async function main() {
  console.log(`\n═══ Import CREA (${PRODUCTS.length}) ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");
  const plan: { p: P; files: string[] }[] = [];
  for (const p of PRODUCTS) {
    const files = matchFiles(p.codes);
    plan.push({ p, files });
    console.log(`  ${p.slug.padEnd(20)} [${p.category.padEnd(11)}] ${files.length}/${p.codes.length}${files.length < p.codes.length ? "  ⚠ mist " + (p.codes.length - files.length) : ""}`);
  }
  if (!APPLY) { console.log("\nDry-run."); process.exit(0); }

  for (const { p, files } of plan) {
    if (!files.length) { console.log(`⏭ skip ${p.slug}`); continue; }
    console.log(`\n📦 ${p.slug}`);
    const images: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const pid = `mokka/${p.category}/${p.slug}/${String(i + 1).padStart(2, "0")}`;
      try {
        const r = await cloudinary.uploader.upload(path.join(ROOM, files[i]), {
          public_id: pid, overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
        });
        images.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch (e) { console.error(`\n  ✗ ${files[i]}: ${e instanceof Error ? e.message : e}`); }
    }
    const specs = { Categorie: p.name.split(" ").slice(-1)[0], Serie: "CREA",
      Materiaal: "Melamine (E1 spaanplaat)", Afwerking: "Wit met licht houtdecor", Kleur: "Wit", Levertijd: "2-4 weken" };
    const data = { name: p.name, description: buildDesc(p.category, p.name), price: 0,
      category: p.category, images: JSON.stringify(images), specs: JSON.stringify(specs),
      colorName: "Wit", hidden: true, stock: 10 };
    const ex = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (ex) { await prisma.product.update({ where: { id: ex.id }, data }); console.log(` ✓ updated (${images.length})`); }
    else { await prisma.product.create({ data: { slug: p.slug, ...data } }); console.log(` ✓ created (${images.length})`); }
  }
  console.log(`\n✅ CREA klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
