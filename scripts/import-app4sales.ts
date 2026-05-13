/**
 * Importeer app4sales producten uit scripts/app4sales-products.json.
 *
 * Voor elk product:
 *   1. Auto-categoriseer op basis van naam (DT=eettafels, CT=salontafels, etc.)
 *   2. Upload bron naar Cloudinary
 *   3. Run gen pipeline (e_background_removal → e_gen_background_replace) met
 *      categorie-specifieke scene prompt
 *   4. Genereer 3 detail crops
 *   5. Insert in DB met prijs ×2 (B2B → consument markup)
 *
 * Gebruik:
 *   npx tsx scripts/import-app4sales.ts                # alle 80 producten
 *   npx tsx scripts/import-app4sales.ts --limit=5      # eerste 5 voor test
 *   npx tsx scripts/import-app4sales.ts --only=910003124
 */

import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
import sharp from "sharp";

config({ path: ".env.local" });
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const HERO_W = 2000;
const CROP_SIZE = 1000;
const PRICE_MARKUP = 2.0;  // B2B → consumer

interface RawProduct {
  code: string; name: string;
  price: number | null; originalPrice: number | null;
  imageUrl: string; inStock: boolean;
  catalogEdition: string; filterNote?: string;
}

interface CategoryInfo {
  category: string;
  subType: string;
  scenePrompt: string;
}

// Categorisering met categorie-specifieke gen scene prompts
function categorize(name: string): CategoryInfo {
  const n = name.toUpperCase();
  const baseDining = "modern luxe dining room interior soft cream painted walls polished light oak wood floor large windows with soft natural daylight neutral palette premium interior photography";
  const baseLiving = "modern luxe living room interior soft cream painted walls polished light oak wood floor large windows with soft natural daylight neutral cream palette premium interior photography";
  const baseEntry = "modern luxe entryway interior soft cream plaster wall light oak wood floor soft natural daylight minimal contemporary decor neutral palette premium interior photography";

  if (/\bMIRROR\b|\bSPIEGEL\b|WALL DECORATION/.test(n)) {
    return { category: "spiegels", subType: "Spiegel/Wandaccessoire", scenePrompt: baseEntry };
  }
  // Verlichting: "LIGHT" alleen als compleet woord en NIET in "LIGHT BEIGE" kleurpatroon
  // Beter: zoek expliciet naar fixture-types
  if (/\bCEILING LIGHT\b|\bCHANDELIER\b|\bLAMP\b|\bPENDANT\b|\bWALL LIGHT\b|\bSCONCE\b/.test(n)) {
    return { category: "verlichting", subType: "Lamp", scenePrompt: baseLiving };
  }
  if (/\bCHAIR\b|\bSTOEL\b/.test(n)) {
    return { category: "stoelen", subType: "Eetkamerstoel", scenePrompt: baseDining };
  }
  if (/\bEXT\.?\s*DT|\bDT\b|\bDINING\b/.test(n)) {
    return { category: "eettafels", subType: "Eettafel", scenePrompt: baseDining };
  }
  if (/\bCT\b|\bCOFFEE\b|\bSALON\b/.test(n)) {
    return { category: "salontafels", subType: "Salontafel", scenePrompt: baseLiving };
  }
  if (/\bET\b\s|\bSIDE TABLE\b|\bEND TABLE\b/.test(n)) {
    return { category: "bijzettafels", subType: "Bijzettafel", scenePrompt: baseLiving };
  }
  if (/\bTT\b|\bTV TABLE\b|\bTV STAND\b/.test(n)) {
    return { category: "tv-meubels", subType: "TV-meubel", scenePrompt: baseLiving };
  }
  if (/\bBF\b|\bBUFFET\b|\bSIDEBOARD\b|\bCABINET\b/.test(n)) {
    return { category: "kasten", subType: "Dressoir", scenePrompt: baseLiving };
  }
  // Fallback
  return { category: "tafels", subType: "Tafel", scenePrompt: baseLiving };
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  return {
    only: get("only"),
    limit: get("limit") ? parseInt(get("limit")!, 10) : undefined,
    skipExisting: !args.includes("--force"),
  };
}

async function uploadFromUrl(sourceUrl: string, slug: string): Promise<string> {
  const r = await cloudinary.uploader.upload(sourceUrl, {
    public_id: `mokka/_raw/app4sales/${slug}`,
    overwrite: true,
    resource_type: "image",
  });
  return r.public_id;
}

async function fetchHero(rawId: string, _scenePrompt: string): Promise<Buffer> {
  // Foto's zoals ze zijn — geen padding/crop. Alleen kwaliteit + format optimalisatie.
  const url = `https://res.cloudinary.com/${CLOUD}/image/upload/q_95,f_jpg/${rawId}.jpg`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (attempt < 3) {
      console.log(`    pending (${res.status}), retry in ${3 + attempt}s...`);
      await new Promise((r) => setTimeout(r, (3 + attempt) * 1000));
    } else throw new Error(`fetch failed: ${res.status}`);
  }
  throw new Error("unreachable");
}

async function makeCrops(hero: Buffer): Promise<Buffer[]> {
  // Bron is studio-foto — geen detail-crops, alleen 1 thumbnail-versie van hero
  const thumb = await sharp(hero)
    .resize(CROP_SIZE, CROP_SIZE, { fit: "inside" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  return [thumb];
}

interface UploadResult { url: string; w: number; h: number; }
async function uploadFinal(buf: Buffer, publicId: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: "image", overwrite: true },
      (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error("no upload result"));
        resolve({ url: result.secure_url, w: result.width, h: result.height });
      },
    );
    stream.end(buf);
  });
}

function buildDescription(p: RawProduct, cat: CategoryInfo): string {
  // Naam parsen: "KIMBERLY DT 160X90 BLACK VENEER PLAIN" → serie + afmeting + finish
  const parts = p.name.split(/\s+/);
  const finish = parts.slice(-3).join(" "); // "BLACK VENEER PLAIN"
  return `${cat.subType} uit de ${parts[0]}-serie, ${finish.toLowerCase()}. Premium kwaliteit met duurzame materialen.`;
}

function buildSpecs(p: RawProduct, cat: CategoryInfo): Record<string, string> {
  const specs: Record<string, string> = {
    Categorie: cat.subType,
    Serie: p.name.split(/\s+/)[0],
  };
  // Probeer afmetingen te extraheren uit naam (bv "160X90X75" of "130 Ø")
  const dimM = p.name.match(/(\d+(?:[.,]\d+)?(?:[xX×]\d+(?:[.,]\d+)?){1,2})/);
  if (dimM) specs.Afmetingen = dimM[1].replace(/x/gi, " × ") + " cm";
  const diaM = p.name.match(/(\d+)\s*Ø/);
  if (diaM) specs.Afmetingen = `Ø ${diaM[1]} cm`;
  // Finish
  if (/VENEER/i.test(p.name)) specs.Afwerking = "Veneer";
  if (/VISGRAAT/i.test(p.name)) specs.Patroon = "Visgraat";
  if (/PLAIN/i.test(p.name)) specs.Patroon = (specs.Patroon ? specs.Patroon + " / " : "") + "Plain";
  // Kleur
  if (/BLACK/i.test(p.name)) specs.Kleur = "Zwart";
  else if (/CREAM|CREAME|CRÈME/i.test(p.name)) specs.Kleur = "Crème";
  else if (/FLINTSTONE/i.test(p.name)) specs.Kleur = "Flintstone";
  else if (/BROWN|BRUIN/i.test(p.name)) specs.Kleur = "Bruin";
  else if (/WHITE|WIT/i.test(p.name)) specs.Kleur = "Wit";

  specs.Levertijd = "2-4 weken";
  return specs;
}

function buildProductName(p: RawProduct, cat: CategoryInfo): string {
  // "KIMBERLY DT 160X90 BLACK VENEER PLAIN" → "Kimberly Eettafel 160×90 Zwart Veneer"
  const parts = p.name.split(/\s+/);
  const series = parts[0].charAt(0) + parts[0].slice(1).toLowerCase();
  const dim = p.name.match(/(\d+(?:[xX]\d+(?:[xX]\d+)?)|(\d+\s*Ø))/i);
  const sizeText = dim?.[0]?.replace(/x/gi, "×") ?? "";
  const colorMap: Record<string, string> = {
    BLACK: "Zwart", CREAM: "Crème", CREAME: "Crème", FLINTSTONE: "Flintstone",
    BROWN: "Bruin", WHITE: "Wit", OAK: "Eiken",
  };
  let color = "";
  for (const [en, nl] of Object.entries(colorMap)) {
    if (p.name.toUpperCase().includes(en)) { color = nl; break; }
  }
  return [series, cat.subType, sizeText, color].filter(Boolean).join(" ").trim();
}

async function processOne(p: RawProduct, dedupeIdx: number, skipExisting: boolean): Promise<{ slug: string; ok: boolean; error?: string }> {
  const cat = categorize(p.name);
  const baseSlug = slugify(`${p.name}`);
  const slug = dedupeIdx === 0 ? baseSlug : `${baseSlug}-${dedupeIdx}`;
  const t0 = Date.now();
  console.log(`\n[${p.code}] ${p.name}`);
  console.log(`  cat: ${cat.category}/${cat.subType} | slug: ${slug}`);

  if (skipExisting) {
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      console.log(`  skip — bestaat al`);
      return { slug, ok: true };
    }
  }

  try {
    console.log(`  upload raw...`);
    const rawId = await uploadFromUrl(p.imageUrl, slug);

    console.log(`  gen-bg scene...`);
    const hero = await fetchHero(rawId, cat.scenePrompt);
    console.log(`    hero ${(hero.length / 1024).toFixed(0)} kB`);

    const crops = await makeCrops(hero);
    console.log(`  upload final...`);
    const heroUp = await uploadFinal(hero, `mokka/${cat.category}/${slug}/hero`);
    const cropsUp = await Promise.all(
      crops.map((c, i) => uploadFinal(c, `mokka/${cat.category}/${slug}/detail-${i + 1}`)),
    );
    const images = [heroUp, ...cropsUp].map((u) => ({ url: u.url, w: u.w, h: u.h }));

    const productName = buildProductName(p, cat);
    const description = buildDescription(p, cat);
    const specs = buildSpecs(p, cat);
    const consumerPrice = p.price ? Math.round(p.price * PRICE_MARKUP) : 599;

    await prisma.product.upsert({
      where: { slug },
      create: {
        slug,
        name: productName,
        description,
        price: consumerPrice,
        category: cat.category,
        images: JSON.stringify(images),
        featured: false,
        stock: p.inStock ? 5 : 0,
        deliveryTime: "2-4 weken",
        specs: JSON.stringify(specs),
      },
      update: {
        name: productName,
        description,
        price: consumerPrice,
        category: cat.category,
        images: JSON.stringify(images),
        stock: p.inStock ? 5 : 0,
        specs: JSON.stringify(specs),
      },
    });
    console.log(`    DB: ${productName} — €${consumerPrice}`);
    console.log(`  klaar in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return { slug, ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`    FOUT: ${msg}`);
    return { slug, ok: false, error: msg };
  }
}

async function main() {
  if (!process.env.CLOUDINARY_API_KEY) {
    console.error("Cloudinary credentials ontbreken in .env.local");
    process.exit(1);
  }

  const args = parseArgs();
  const data: RawProduct[] = JSON.parse(await readFile("scripts/app4sales-products.json", "utf8"));

  let toProcess = data;
  if (args.only) toProcess = toProcess.filter((p) => p.code === args.only);
  if (args.limit) toProcess = toProcess.slice(0, args.limit);

  if (toProcess.length === 0) {
    console.error("geen producten matchen filters");
    process.exit(1);
  }

  console.log(`Processing ${toProcess.length} producten (skipExisting=${args.skipExisting})...`);
  const seenSlug = new Map<string, number>();
  const results: Array<{ slug: string; ok: boolean; error?: string }> = [];
  for (const p of toProcess) {
    const baseSlug = slugify(p.name);
    const idx = seenSlug.get(baseSlug) ?? 0;
    seenSlug.set(baseSlug, idx + 1);
    results.push(await processOne(p, idx, args.skipExisting));
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${ok}/${results.length} ok ===`);
  if (failed.length) {
    console.log("Mislukt:");
    for (const r of failed) console.log(`  ${r.slug}: ${r.error}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
