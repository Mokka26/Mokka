// Import MARVEN — 6 slaapkamer-producten (walnoot/wit). Raw _DSF, vision-gemapt.
// Match per 4-cijfer code, 1 schoonste bestand per code (vermijdt dup-varianten).
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

const ROOM = path.join(process.cwd(), "_import-marven", "1 - Ürünler - Product",
  "1 - Yatak ve Yemek & Bedroom and Dining Room", "2026 - MARVEN", "YATAK ODASI - BEDROOM");

type P = { slug: string; name: string; category: string; codes: string[] };
const PRODUCTS: P[] = [
  { slug: "marven-bed", name: "Marven Bed", category: "bedden",
    codes: ["0057", "0069", "0070", "0071", "0072", "0077", "0686", "0687"] },
  { slug: "marven-kledingkast", name: "Marven Kledingkast", category: "kasten",
    codes: ["0037", "0038", "0039", "0041", "0043", "0051"] },
  { slug: "marven-kaptafel", name: "Marven Kaptafel", category: "slaapkamers",
    codes: ["0028", "0033", "0035", "0052", "0053", "0055", "0056", "0064", "0065"] },
  { slug: "marven-nachtkastje", name: "Marven Nachtkastje", category: "kasten",
    codes: ["0079", "0082", "0083"] },
  { slug: "marven-ladekast", name: "Marven Ladekast", category: "kasten",
    codes: ["0084", "0086", "0088"] },
  { slug: "marven-spiegel", name: "Marven Spiegel", category: "spiegels",
    codes: ["0063"] },
];

// 1 schoonste bestand per code: kortste filename die de code bevat
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
  const t: Record<string, string> = { bedden: "Bed", kasten: "Kast", slaapkamers: "Kaptafel", spiegels: "Spiegel" };
  return `${t[category] ?? "Meubelstuk"} uit de Marven-collectie in walnoot met wit. Uitgevoerd in melamine (E1-spaanplaat). Levertijd: 2-4 weken.`;
}

async function main() {
  console.log(`\n═══ Import MARVEN (${PRODUCTS.length}) ═══`);
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
    const specs = { Categorie: p.name.split(" ").slice(-1)[0], Serie: "MARVEN",
      Materiaal: "Melamine (E1 spaanplaat)", Afwerking: "Walnoot met wit", Kleur: "Walnoot", Levertijd: "2-4 weken" };
    const data = { name: p.name, description: buildDesc(p.category), price: 0,
      category: p.category, images: JSON.stringify(images), specs: JSON.stringify(specs),
      colorName: "Walnoot", hidden: true, stock: 10 };
    const ex = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (ex) { await prisma.product.update({ where: { id: ex.id }, data }); console.log(` ✓ updated (${images.length})`); }
    else { await prisma.product.create({ data: { slug: p.slug, ...data } }); console.log(` ✓ created (${images.length})`); }
  }
  console.log(`\n✅ MARVEN klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
