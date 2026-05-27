// Import LivingFurn chairs-collectie (dealer). Magento-shop; gallery-images
// uit de detailpagina, ge-isoleerd op SKU (geen cross-sell). Echte prijzen →
// zichtbaar importeren. source="LivingFurn".
//
// Dry-run:  npx tsx scripts/import-livingfurn-chairs.ts
// Apply:    npx tsx scripts/import-livingfurn-chairs.ts --apply

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BASE = "https://www.livingfurn.nl/nl";
const SOURCE = "LivingFurn";

type Item = { src: string; slug: string; name: string; price: number; category: string; group: string | null; color: string };

const ITEMS: Item[] = [
  { src: "aurelia-beige", slug: "lf-aurelia-beige", name: "Aurelia Beige", price: 279, category: "fauteuils", group: null, color: "Beige" },
  { src: "tara-sand", slug: "lf-tara-sand", name: "Tara Sand", price: 219, category: "stoelen", group: "lf-tara", color: "Sand" },
  { src: "tara-beige", slug: "lf-tara-beige", name: "Tara Beige", price: 219, category: "stoelen", group: "lf-tara", color: "Beige" },
  { src: "blake-caramel", slug: "lf-blake-caramel", name: "Blake Caramel", price: 299, category: "fauteuils", group: "lf-blake", color: "Caramel" },
  { src: "blake-beige", slug: "lf-blake-beige", name: "Blake Beige", price: 299, category: "fauteuils", group: "lf-blake", color: "Beige" },
  { src: "blake-desert", slug: "lf-blake-desert", name: "Blake Desert", price: 299, category: "fauteuils", group: "lf-blake", color: "Desert" },
  { src: "tori-sand", slug: "lf-tori-sand", name: "Tori Sand", price: 219, category: "stoelen", group: "lf-tori", color: "Sand" },
  { src: "tori-salmon", slug: "lf-tori-salmon", name: "Tori Salmon", price: 219, category: "stoelen", group: "lf-tori", color: "Salmon" },
  { src: "tori-sand-natural", slug: "lf-tori-sand-natural", name: "Tori Sand Natural", price: 219, category: "stoelen", group: "lf-tori", color: "Sand Natural" },
  { src: "milan-beige", slug: "lf-milan-beige", name: "Milan Beige", price: 129, category: "stoelen", group: null, color: "Beige" },
  { src: "jade-beige", slug: "lf-jade-beige", name: "Jade Beige", price: 179, category: "stoelen", group: null, color: "Beige" },
  { src: "isabel-beige", slug: "lf-isabel-beige", name: "Isabel Beige", price: 179, category: "stoelen", group: null, color: "Beige" },
  { src: "tommy-bisque-oasis", slug: "lf-tommy-bisque-oasis", name: "Tommy Bisque Oasis", price: 159, category: "stoelen", group: null, color: "Bisque Oasis" },
  { src: "dilan-venga-hazel", slug: "lf-dilan-venga-hazel", name: "Dilan Venga Hazel", price: 299, category: "fauteuils", group: "lf-dilan-venga", color: "Hazel" },
  { src: "dilan-venga-cognac", slug: "lf-dilan-venga-cognac", name: "Dilan Venga Cognac", price: 299, category: "fauteuils", group: "lf-dilan-venga", color: "Cognac" },
  { src: "dilan-venga-liver", slug: "lf-dilan-venga-liver", name: "Dilan Venga Liver", price: 299, category: "fauteuils", group: "lf-dilan-venga", color: "Liver" },
  { src: "dilan-hush-oak", slug: "lf-dilan-hush-oak", name: "Dilan Hush Oak", price: 249, category: "fauteuils", group: "lf-dilan-hush", color: "Oak" },
  { src: "dilan-hush-walnut", slug: "lf-dilan-hush-walnut", name: "Dilan Hush Walnut", price: 249, category: "fauteuils", group: "lf-dilan-hush", color: "Walnut" },
  { src: "britt-beige", slug: "lf-britt-beige", name: "Britt Beige", price: 399, category: "fauteuils", group: "lf-britt", color: "Beige" },
  { src: "britt-cream", slug: "lf-britt-cream", name: "Britt Cream", price: 399, category: "fauteuils", group: "lf-britt", color: "Cream" },
  { src: "britt-bordeaux", slug: "lf-britt-bordeaux", name: "Britt Bordeaux", price: 399, category: "fauteuils", group: "lf-britt", color: "Bordeaux" },
  { src: "linn-desert-bronze", slug: "lf-linn-desert-bronze", name: "Linn Desert Bronze", price: 179, category: "stoelen", group: "lf-linn", color: "Desert Bronze" },
  { src: "linn-beige-bronze-1", slug: "lf-linn-beige-bronze", name: "Linn Beige Bronze", price: 179, category: "stoelen", group: "lf-linn", color: "Beige Bronze" },
  { src: "linn-taupe", slug: "lf-linn-taupe", name: "Linn Taupe", price: 179, category: "stoelen", group: "lf-linn", color: "Taupe" },
  { src: "megan-taupe", slug: "lf-megan-taupe", name: "Megan Taupe", price: 179, category: "stoelen", group: "lf-megan", color: "Taupe" },
  { src: "linn-bisque-oasis", slug: "lf-linn-bisque-oasis", name: "Linn Bisque Oasis", price: 179, category: "stoelen", group: "lf-linn", color: "Bisque Oasis" },
  { src: "megan-bisque-oasis", slug: "lf-megan-bisque-oasis", name: "Megan Bisque Oasis", price: 179, category: "stoelen", group: "lf-megan", color: "Bisque Oasis" },
  { src: "linn-toffee", slug: "lf-linn-toffee", name: "Linn Toffee", price: 179, category: "stoelen", group: "lf-linn", color: "Toffee" },
  { src: "megan-toffee", slug: "lf-megan-toffee", name: "Megan Toffee", price: 179, category: "stoelen", group: "lf-megan", color: "Toffee" },
  { src: "micah-hush-walnut", slug: "lf-micah-hush-walnut", name: "Micah Hush Walnut", price: 109, category: "stoelen", group: "lf-micah", color: "Hush Walnut" },
  { src: "micah-hush-oak", slug: "lf-micah-hush-oak", name: "Micah Hush Oak", price: 109, category: "stoelen", group: "lf-micah", color: "Hush Oak" },
  { src: "tess-cream", slug: "lf-tess-cream", name: "Tess Cream", price: 119, category: "stoelen", group: "lf-tess", color: "Cream" },
  { src: "tess-bordeaux", slug: "lf-tess-bordeaux", name: "Tess Bordeaux", price: 119, category: "stoelen", group: "lf-tess", color: "Bordeaux" },
  { src: "tess-honey", slug: "lf-tess-honey", name: "Tess Honey", price: 119, category: "stoelen", group: "lf-tess", color: "Honey" },
  { src: "tom-sand", slug: "lf-tom-sand", name: "Tom Sand", price: 299, category: "fauteuils", group: null, color: "Sand" },
  { src: "sven-toffee", slug: "lf-sven-toffee", name: "Sven Toffee", price: 399, category: "fauteuils", group: "lf-sven", color: "Toffee" },
  { src: "sven-bisque-oasis", slug: "lf-sven-bisque-oasis", name: "Sven Bisque Oasis", price: 399, category: "fauteuils", group: "lf-sven", color: "Bisque Oasis" },
  { src: "helen-turtle", slug: "lf-helen-turtle", name: "Helen Turtle", price: 219, category: "stoelen", group: "lf-helen", color: "Turtle" },
  { src: "helen-sand-natural", slug: "lf-helen-sand-natural", name: "Helen Sand Natural", price: 219, category: "stoelen", group: "lf-helen", color: "Sand Natural" },
  { src: "coco-beige", slug: "lf-coco-beige", name: "Coco Beige", price: 399, category: "fauteuils", group: "lf-coco", color: "Beige" },
  { src: "coco-beige-sofa", slug: "lf-coco-beige-sofa", name: "Coco Beige Sofa", price: 499, category: "bankstellen", group: "lf-coco-sofa", color: "Beige" },
  { src: "brix-finn-beige-1", slug: "lf-brix-finn-black", name: "Brix Finn Black", price: 129, category: "stoelen", group: "lf-brix-finn", color: "Black" },
  { src: "brix-finn-beige", slug: "lf-brix-finn-beige", name: "Brix Finn Beige", price: 129, category: "stoelen", group: "lf-brix-finn", color: "Beige" },
  { src: "30997-doreen-boucle-white", slug: "lf-doreen-boucle-white", name: "Doreen Boucle White", price: 179, category: "stoelen", group: "lf-doreen", color: "Boucle White" },
  { src: "30995-doreen-boucle-brown", slug: "lf-doreen-boucle-brown", name: "Doreen Boucle Brown", price: 179, category: "stoelen", group: "lf-doreen", color: "Boucle Brown" },
  { src: "30994-doreen-boucle-beige", slug: "lf-doreen-boucle-beige", name: "Doreen Boucle Beige", price: 179, category: "stoelen", group: "lf-doreen", color: "Boucle Beige" },
  { src: "31230-doreen-sneak-natural", slug: "lf-doreen-sneak-natural", name: "Doreen Sneak Natural", price: 179, category: "stoelen", group: "lf-doreen", color: "Sneak Natural" },
  { src: "capp-blossom-lodge", slug: "lf-capp-blossom-lodge", name: "Capp Blossom Lodge", price: 159, category: "stoelen", group: "lf-capp", color: "Blossom Lodge" },
  { src: "capp-beige-lodge", slug: "lf-capp-beige-lodge", name: "Capp Beige Lodge", price: 159, category: "stoelen", group: "lf-capp", color: "Beige Lodge" },
  { src: "capp-taupe", slug: "lf-capp-taupe", name: "Capp Taupe", price: 159, category: "stoelen", group: "lf-capp", color: "Taupe" },
  { src: "30992-capp-beige-velvet", slug: "lf-capp-beige-velvet", name: "Capp Beige Velvet", price: 159, category: "stoelen", group: "lf-capp", color: "Beige Velvet" },
  { src: "13443-capp-rust-velvet", slug: "lf-capp-rust-velvet", name: "Capp Rust Velvet", price: 159, category: "stoelen", group: "lf-capp", color: "Rust Velvet" },
  { src: "31145-thomas-toffee", slug: "lf-thomas-toffee", name: "Thomas Toffee", price: 199, category: "stoelen", group: "lf-thomas", color: "Toffee" },
  { src: "31144-thomas-sand", slug: "lf-thomas-sand", name: "Thomas Sand", price: 199, category: "stoelen", group: "lf-thomas", color: "Sand" },
  { src: "31143-thomas-brique", slug: "lf-thomas-brique", name: "Thomas Brique", price: 199, category: "stoelen", group: "lf-thomas", color: "Brique" },
  { src: "31146-daphne-greige", slug: "lf-daphne-greige", name: "Daphne Greige", price: 279, category: "stoelen", group: "lf-daphne", color: "Greige" },
  { src: "31150-daphne-sand", slug: "lf-daphne-sand", name: "Daphne Sand", price: 279, category: "stoelen", group: "lf-daphne", color: "Sand" },
  { src: "31608-coco-sofa-blossom-lodge", slug: "lf-coco-sofa-blossom-lodge", name: "Coco Sofa Blossom Lodge", price: 499, category: "bankstellen", group: "lf-coco-sofa", color: "Blossom Lodge" },
  { src: "coco-blossom-lodge", slug: "lf-coco-blossom-lodge", name: "Coco Blossom Lodge", price: 399, category: "fauteuils", group: "lf-coco", color: "Blossom Lodge" },
];

const COLOR_HEX: Record<string, string> = {
  Beige: "#D9CBB3", Sand: "#D8C9B0", "Sand Natural": "#CBB89C", Caramel: "#B07840",
  Desert: "#C9A87E", Salmon: "#E0A18C", Cream: "#ECE6D8", Bordeaux: "#5E2028",
  Honey: "#C8973F", Taupe: "#8C7F70", Toffee: "#8A5A3C", Turtle: "#5A5E4A",
  Greige: "#B3A99A", Brique: "#9C5A44", Cognac: "#8A4B2A", Liver: "#6E3B30",
  Hazel: "#7A4A2E", Walnut: "#5A3E2B", Oak: "#C8A877", Black: "#1C1C1C",
  "Hush Walnut": "#5A3E2B", "Hush Oak": "#C8A877", "Desert Bronze": "#B89A72",
  "Beige Bronze": "#C2A98A", "Bisque Oasis": "#D7C7B0", "Blossom Lodge": "#C9B8A8",
  "Beige Lodge": "#D9CBB3", "Beige Velvet": "#D9CBB3", "Rust Velvet": "#9C5A44",
  "Boucle White": "#EFEAE0", "Boucle Brown": "#6E4B33", "Boucle Beige": "#D9CBB3",
  "Sneak Natural": "#CBB89C",
};

function typeLabel(cat: string): string {
  if (cat === "fauteuils") return "Fauteuil";
  if (cat === "bankstellen") return "Bank";
  return "Eetkamerstoel";
}
function description(item: Item): string {
  const t = typeLabel(item.category).toLowerCase();
  return `Gestoffeerde ${t} in ${item.color.toLowerCase()}. Comfortabel zitcomfort met een tijdloze, strakke lijn — past in elk modern interieur.`;
}

async function fetchImages(src: string): Promise<string[]> {
  const res = await fetch(`${BASE}/${src}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // Magento-gallery: "full":"https:\/\/...jpg"
  const raw: string[] = [];
  const re = /"full":"(https:[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) raw.push(m[1].replace(/\\\//g, "/"));
  // filter montage-/instructie-afbeeldingen
  const clean = raw.filter((u) => !/instruction|assembly|montage|maatschets|dimension/i.test(u));
  // isoleer eigen gallery op meest-voorkomende SKU in de bestandsnaam
  const skuOf = (u: string) => (u.match(/\/(\d{4,})(?:[_.])/) || [])[1] ?? "";
  const freq = new Map<string, number>();
  for (const u of clean) { const s = skuOf(u); if (s) freq.set(s, (freq.get(s) || 0) + 1); }
  const mainSku = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const own = mainSku ? clean.filter((u) => skuOf(u) === mainSku) : clean;
  // dedupe, behoud volgorde
  return [...new Set(own)];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n═══ LivingFurn chairs — ${ITEMS.length} producten ═══`);
  console.log(APPLY ? "MODE: APPLY (live)\n" : "MODE: dry-run\n");

  // FASE 1 — fetch + upload (geen DB)
  const built: { item: Item; uploaded: { url: string; w: number; h: number }[] }[] = [];
  for (const item of ITEMS) {
    let imgs: string[] = [];
    try { imgs = await fetchImages(item.src); }
    catch (e) { console.log(`✗ ${item.src}: ${e instanceof Error ? e.message : e}`); }
    if (!APPLY) {
      console.log(`  ${imgs.length > 0 ? "✓" : "⚠"} ${item.slug.padEnd(30)} €${String(item.price).padStart(3)} ${item.category.padEnd(11)} ${imgs.length} foto's`);
      await sleep(150);
      continue;
    }
    process.stdout.write(`📦 ${item.slug} `);
    const uploaded: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < imgs.length; i++) {
      try {
        const r = await cloudinary.uploader.upload(imgs[i], {
          public_id: `mokka/${item.category}/${item.slug}/${String(i + 1).padStart(2, "0")}`,
          overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
        });
        uploaded.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch { process.stdout.write("x"); }
    }
    built.push({ item, uploaded });
    process.stdout.write(` (${uploaded.length})\n`);
    await sleep(150);
  }

  if (!APPLY) { console.log("\nDry-run klaar."); await prisma.$disconnect(); process.exit(0); }

  // FASE 2 — DB
  console.log("\n─── DB ───");
  for (const { item, uploaded } of built) {
    if (uploaded.length === 0) { console.log(`⏭ skip ${item.slug} (geen foto's)`); continue; }
    const specs = { Categorie: typeLabel(item.category), Materiaal: "Stof", Kleur: item.color };
    const data = {
      name: item.name, description: description(item),
      price: item.price, category: item.category,
      images: JSON.stringify(uploaded), specs: JSON.stringify(specs),
      colorGroup: item.group, colorName: item.color, colorHex: COLOR_HEX[item.color] ?? null,
      source: SOURCE, hidden: false, stock: 10,
    };
    await prisma.product.upsert({ where: { slug: item.slug }, update: data, create: { slug: item.slug, ...data } });
    console.log(`  ✓ ${item.slug} (${uploaded.length})`);
  }
  console.log(`\n✅ LivingFurn klaar — zichtbaar, met echte prijzen, getagd '${SOURCE}'.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
