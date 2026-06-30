// Import Twenty Bedding boxspring-sets als bedden.
// - 7 modellen mét verkoopprijs → zichtbaar, maat-varianten met SET-prijs
//   (opbergbed + hoofdbord + matras). 'Op bestelling'-maten in het label.
// - 5 modellen zonder prijs → verborgen (price 0) tot prijzen bekend zijn.
// Foto's komen uit de twee aangeleverde mappen (uitgepakt in scratchpad).
//
// Dry-run: npx tsx scripts/import-twenty-bedding.ts
// Apply:   npx tsx scripts/import-twenty-bedding.ts --apply
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const SP = "C:/Users/konia/AppData/Local/Temp/claude/C--Users-konia-OneDrive---Stichting-Hogeschool-Utrecht-moka/c41c137f-e437-4c65-9282-be10a184a39e/scratchpad";

type Size = { w: number; price: number; order?: boolean };
type Model = {
  slug: string; name: string; color: string; photo: string;
  sizes: Size[]; // leeg = nog geen prijs → verborgen
};

// SET-prijzen (opbergbed + hoofdbord + matras) uit Twenty Bedding Verkoopprijslijst.
const MODELS: Model[] = [
  { slug: "tb-lina", name: "Lina Boxspring", color: "Twenty-01", photo: "beds_a/Lina.jpg", sizes: [
    { w: 140, price: 1695 }, { w: 160, price: 1795 }, { w: 180, price: 1895 }, { w: 200, price: 2200, order: true } ] },
  { slug: "tb-happy", name: "Happy Boxspring", color: "Twenty-03", photo: "beds_a/Happy.jpg", sizes: [
    { w: 140, price: 1695 }, { w: 160, price: 1795 }, { w: 180, price: 1895 }, { w: 200, price: 2200, order: true } ] },
  { slug: "tb-prestige", name: "Prestige Boxspring", color: "Twenty-06", photo: "beds_a/Prestige.jpg", sizes: [
    { w: 140, price: 2295 }, { w: 160, price: 2395 }, { w: 180, price: 2595 }, { w: 200, price: 2950, order: true } ] },
  { slug: "tb-montana", name: "Montana Boxspring", color: "Puma-03", photo: "beds_a/Model Montana.jpg", sizes: [
    { w: 140, price: 1695, order: true }, { w: 160, price: 1795 }, { w: 180, price: 1895 }, { w: 200, price: 2200, order: true } ] },
  { slug: "tb-gonessa", name: "Gonessa Boxspring", color: "Puma-16", photo: "beds_a/Model Gonessa.jpg", sizes: [
    { w: 140, price: 1695, order: true }, { w: 160, price: 1795 }, { w: 180, price: 1895 }, { w: 200, price: 2200, order: true } ] },
  { slug: "tb-rolex", name: "Rolex Boxspring", color: "Twenty-17", photo: "beds_a/Model Rolex.jpg", sizes: [
    { w: 90, price: 830 }, { w: 100, price: 900, order: true }, { w: 120, price: 1100 }, { w: 140, price: 1295 },
    { w: 160, price: 1495 }, { w: 180, price: 1645 }, { w: 200, price: 1795, order: true } ] },
  { slug: "tb-smart", name: "Smart Boxspring", color: "Puma-01", photo: "beds_a/Smart.jpg", sizes: [
    { w: 90, price: 880, order: true }, { w: 100, price: 940, order: true }, { w: 120, price: 1150, order: true },
    { w: 140, price: 1340, order: true }, { w: 160, price: 1580 }, { w: 180, price: 1710 }, { w: 200, price: 1840, order: true } ] },
  // Zonder prijs → verborgen tot prijzen bekend zijn.
  { slug: "tb-amor", name: "Amor Boxspring", color: "", photo: "beds_b/AMOR.png", sizes: [] },
  { slug: "tb-arvalo", name: "Arvalo Boxspring", color: "", photo: "beds_b/Arvalo.png", sizes: [] },
  { slug: "tb-cushie", name: "Cushie Boxspring", color: "", photo: "beds_b/CUSHIE.png", sizes: [] },
  { slug: "tb-sereno", name: "Sereno Boxspring", color: "", photo: "beds_b/Sereno.jpeg", sizes: [] },
  { slug: "tb-yenismart", name: "Yeni Smart Boxspring", color: "", photo: "beds_b/YeniSmart.jpg", sizes: [] },
];

function sizeVariantsJson(sizes: Size[]): string | null {
  if (!sizes.length) return null;
  return JSON.stringify(sizes.map((s) => ({
    label: `${s.w} × 200${s.order ? " (op bestelling)" : ""}`,
    price: s.price,
  })));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n═══ Twenty Bedding — ${MODELS.length} modellen ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  // FASE 1 — upload foto's
  const built: { m: Model; img: { url: string; w: number; h: number } | null }[] = [];
  for (const m of MODELS) {
    const path = `${SP}/${m.photo}`;
    const priced = m.sizes.length > 0;
    const base = priced ? Math.min(...m.sizes.map((s) => s.price)) : 0;
    if (!existsSync(path)) { console.log(`✗ ${m.slug}: foto ontbreekt (${m.photo})`); built.push({ m, img: null }); continue; }
    if (!APPLY) {
      console.log(`  ${priced ? "✓ zichtbaar" : "· verborgen"}  ${m.slug.padEnd(14)} ${priced ? `vanaf €${base}  ${m.sizes.length} maten` : "geen prijs"}`);
      continue;
    }
    process.stdout.write(`📦 ${m.slug} `);
    try {
      const r = await cloudinary.uploader.upload(path, {
        public_id: `mokka/bedden/${m.slug}/01`,
        overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
      });
      built.push({ m, img: { url: r.secure_url, w: r.width, h: r.height } });
      process.stdout.write("✓\n");
    } catch (e) { process.stdout.write(`x (${e instanceof Error ? e.message : e})\n`); built.push({ m, img: null }); }
    await sleep(120);
  }

  if (!APPLY) { console.log("\nDry-run klaar — run met --apply."); await prisma.$disconnect(); process.exit(0); }

  // FASE 2 — DB upsert
  console.log("\n─── DB ───");
  for (const { m, img } of built) {
    if (!img) { console.log(`⏭ skip ${m.slug} (geen foto)`); continue; }
    const priced = m.sizes.length > 0;
    const base = priced ? Math.min(...m.sizes.map((s) => s.price)) : 0;
    const specs: Record<string, string> = { Categorie: "Boxspring", Type: "Opbergbed-set (opbergbed + hoofdbord + matras)" };
    if (m.color) specs["Stofkleur"] = m.color;
    const naam = m.name.replace(" Boxspring", "");
    const data = {
      name: m.name,
      description: `De ${naam} is een complete boxspring-set: opbergbed met ruime lade, gestoffeerd hoofdbord en bijpassend matras. Verkrijgbaar in meerdere maten.`,
      price: base,
      category: "bedden",
      images: JSON.stringify([img]),
      specs: JSON.stringify(specs),
      sizeVariants: sizeVariantsJson(m.sizes),
      // Nachtkast apart bij te bestellen: 1 = €220, 2 = €400 (per bed te wijzigen).
      nachtkastMode: "optional", nachtkastPrice: 220, nachtkastPrice2: 400,
      source: "Twenty Bedding",
      hidden: !priced,
      stock: 10,
    };
    await prisma.product.upsert({ where: { slug: m.slug }, update: data, create: { slug: m.slug, ...data } });
    console.log(`  ✓ ${m.slug}${priced ? "" : "  (verborgen)"}`);
  }
  console.log(`\n✅ Twenty Bedding klaar — source 'Twenty Bedding'. 7 zichtbaar, 5 verborgen (prijs later).`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
