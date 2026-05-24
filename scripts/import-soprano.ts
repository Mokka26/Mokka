// Import SOPRANO slaapkamer — 5 producten (crème + glas + hout). Raw _DSF.
// Match per 4-cijfer code, 1 schoonste bestand per code. Run: [--apply]

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

const ROOM = path.join(process.cwd(), "_import-soprano", "1 - Ürünler - Product",
  "1 - Yatak ve Yemek & Bedroom and Dining Room", "2026 - SOPRANO", "YATAK ODASI - BEDROOM");

type P = { slug: string; name: string; category: string; codes: string[] };
const PRODUCTS: P[] = [
  { slug: "soprano-bed", name: "Soprano Bed", category: "bedden",
    codes: ["0109", "0131", "0135", "0136", "0137", "0141", "0682", "0683", "0684", "0685", "0092"] },
  { slug: "soprano-kledingkast", name: "Soprano Kledingkast", category: "kasten",
    codes: ["0098", "0101", "0102", "0105", "0106"] },
  { slug: "soprano-kaptafel", name: "Soprano Kaptafel", category: "slaapkamers",
    codes: ["0108", "0111", "0115", "0119", "0124"] },
  { slug: "soprano-nachtkastje", name: "Soprano Nachtkastje", category: "kasten",
    codes: ["0142", "0145", "0146"] },
  { slug: "soprano-ladekast", name: "Soprano Ladekast", category: "kasten",
    codes: ["0116", "0149", "0150", "0152"] },
];

function fileForCode(imgs: string[], code: string): string | null {
  const hits = imgs.filter((f) => f.includes(code)).sort((a, b) => a.length - b.length);
  return hits[0] ?? null;
}
function matchFiles(codes: string[]): string[] {
  const imgs = fs.readdirSync(ROOM).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  const out: string[] = [];
  for (const c of codes) { const f = fileForCode(imgs, c); if (f && !out.includes(f)) out.push(f); }
  return out;
}
function buildDesc(category: string): string {
  const t: Record<string, string> = { bedden: "Bed", kasten: "Kast", slaapkamers: "Kaptafel" };
  return `${t[category] ?? "Meubelstuk"} uit de Soprano-collectie in crème met glas- en houtdetails. Uitgevoerd in melamine (E1-spaanplaat). Levertijd: 2-4 weken.`;
}

async function main() {
  console.log(`\n═══ Import SOPRANO (${PRODUCTS.length}) ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");
  const plan = PRODUCTS.map((p) => ({ p, files: matchFiles(p.codes) }));
  for (const { p, files } of plan)
    console.log(`  ${p.slug.padEnd(22)} [${p.category.padEnd(11)}] ${files.length}/${p.codes.length}`);
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
    const specs = { Categorie: p.name.split(" ").slice(-1)[0], Serie: "SOPRANO",
      Materiaal: "Melamine (E1 spaanplaat)", Afwerking: "Crème met glas/hout", Kleur: "Crème", Levertijd: "2-4 weken" };
    const data = { name: p.name, description: buildDesc(p.category), price: 0,
      category: p.category, images: JSON.stringify(images), specs: JSON.stringify(specs),
      colorName: "Crème", hidden: true, stock: 10 };
    const ex = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (ex) { await prisma.product.update({ where: { id: ex.id }, data }); console.log(` ✓ updated (${images.length})`); }
    else { await prisma.product.create({ data: { slug: p.slug, ...data } }); console.log(` ✓ created (${images.length})`); }
  }
  console.log(`\n✅ SOPRANO klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
