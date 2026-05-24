// Import ANDORA eetkamer — 6 losse producten, hidden, placeholder-prijs.
// Foto's → Cloudinary (mokka/{category}/{slug}/NN), DB-records met specs.
//
// Run:
//   npx tsx scripts/import-andora-dining.ts          # dry-run (toont plan)
//   npx tsx scripts/import-andora-dining.ts --apply  # upload + DB

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

const DINING_DIR = path.join(
  process.cwd(),
  "_import-andora",
  "1 - Ürünler - Product",
  "1 - Yatak ve Yemek & Bedroom and Dining Room",
  "2024 - ANDORA",
  "2 - ANDORA YEMEK - DINING ROOM",
);

// Per product: slug, naam, categorie, foto's (hero = eerste = witte-bg shot)
const PRODUCTS = [
  {
    slug: "andora-dressoir", name: "Andora Dressoir", category: "kasten",
    files: ["NEVİ_129491.jpg", "NEVİ_129497.jpg", "NEVİ_129500.jpg", "NEVİ_129501.jpg", "NEVİ_129493.jpg", "NEVİ_129494.jpg"],
  },
  {
    slug: "andora-eettafel", name: "Andora Eettafel", category: "eettafels",
    files: ["NEVİ_129509.jpg", "NEVİ_129510.jpg", "NEVİ_129504.jpg", "NEVİ_129502.jpg", "NEVİ_129503.jpg", "NEVİ_129505.jpg"],
  },
  {
    slug: "andora-eetkamerstoel", name: "Andora Eetkamerstoel", category: "stoelen",
    files: ["NEVİ_129508.jpg"],
  },
  {
    slug: "andora-tv-meubel", name: "Andora Tv-meubel", category: "tv-meubels",
    files: ["NEVİ_129511.jpg", "NEVİ_129512.jpg", "NEVİ_129516.jpg", "NEVİ_129518.jpg"],
  },
  {
    slug: "andora-salontafel", name: "Andora Salontafel", category: "salontafels",
    files: ["NEVİ_129537.jpg", "NEVİ_129513.jpg"],
  },
  {
    slug: "andora-bijzettafel", name: "Andora Bijzettafel", category: "bijzettafels",
    files: ["Nevi Mobilya 05.02.20255469 kopya 2.jpg"],
  },
];

const SPECS_BASE = {
  Serie: "ANDORA",
  Materiaal: "Melamine (E1 spaanplaat)",
  Afwerking: "Crème met travertijn-accent",
  Kleur: "Crème",
  Levertijd: "2-4 weken",
};

function buildDescription(name: string, category: string): string {
  const typeMap: Record<string, string> = {
    kasten: "Dressoir", eettafels: "Eettafel", stoelen: "Eetkamerstoel",
    "tv-meubels": "Tv-meubel", salontafels: "Salontafel", bijzettafels: "Bijzettafel",
  };
  const type = typeMap[category] ?? "Meubelstuk";
  return `${type} uit de Andora-collectie in crème met travertijn-accent en gouden poten. Uitgevoerd in melamine (E1-spaanplaat). Levertijd: 2-4 weken.`;
}

async function main() {
  console.log(`\n═══ Import ANDORA eetkamer (${PRODUCTS.length} producten) ═══`);
  console.log(APPLY ? "MODE: APPLY (upload + DB)\n" : "MODE: dry-run\n");

  if (!fs.existsSync(DINING_DIR)) {
    console.error(`❌ Map niet gevonden: ${DINING_DIR}`);
    process.exit(1);
  }

  // Valideer dat alle files bestaan
  let allOk = true;
  for (const p of PRODUCTS) {
    for (const f of p.files) {
      if (!fs.existsSync(path.join(DINING_DIR, f))) {
        console.error(`  ⚠ Ontbreekt: ${p.slug} → ${f}`);
        allOk = false;
      }
    }
  }
  if (!allOk) { console.error("\nStop: ontbrekende bestanden."); process.exit(1); }

  for (const p of PRODUCTS) {
    console.log(`  ${p.slug.padEnd(22)} [${p.category}]  ${p.files.length} foto's`);
  }

  if (!APPLY) {
    console.log("\nDry-run — geen upload/DB. Run met --apply.");
    process.exit(0);
  }

  for (const p of PRODUCTS) {
    console.log(`\n📦 ${p.slug} (${p.category})`);
    const images: { url: string; w: number; h: number }[] = [];

    for (let i = 0; i < p.files.length; i++) {
      const filePath = path.join(DINING_DIR, p.files[i]);
      const publicId = `mokka/${p.category}/${p.slug}/${String(i + 1).padStart(2, "0")}`;
      try {
        const r = await cloudinary.uploader.upload(filePath, {
          public_id: publicId,
          overwrite: true,
          resource_type: "image",
          quality: "auto:best",
          fetch_format: "auto",
        });
        images.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch (err) {
        console.error(`\n  ✗ upload ${p.files[i]}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Upsert product
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    const data = {
      name: p.name,
      description: buildDescription(p.name, p.category),
      price: 0, // placeholder — user vult via /admin
      category: p.category,
      images: JSON.stringify(images),
      specs: JSON.stringify({ Categorie: p.name.split(" ").slice(-1)[0], ...SPECS_BASE }),
      colorName: "Crème",
      hidden: true,
      stock: 10,
    };
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      console.log(` ✓ updated (${images.length} foto's)`);
    } else {
      await prisma.product.create({ data: { slug: p.slug, ...data } });
      console.log(` ✓ created (${images.length} foto's)`);
    }
  }

  console.log(`\n✅ Klaar. ${PRODUCTS.length} producten hidden in DB. Zichtbaar maken + prijs via /admin.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
