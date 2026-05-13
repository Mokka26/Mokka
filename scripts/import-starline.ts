/**
 * Importeer banken van starlinemeubel.nl met AI-gegenereerde lifestyle scenes.
 *
 * Pipeline per bank:
 *   1. Upload originele foto naar Cloudinary als `mokka/_raw/starline/<slug>`
 *   2. Fetch hero via Cloudinary `e_gen_background_replace` met merk-prompt
 *      → 1500x1500 wabi-sabi woonkamer scene rondom de bank
 *   3. Sharp: 3 detail-crops (links / midden / rechts) uit de hero
 *   4. Upload hero + crops naar Cloudinary onder `mokka/banken/<slug>/`
 *   5. Insert/update product in Prisma DB
 *
 * Gebruik:
 *   npx tsx scripts/import-starline.ts                # alle TEST_SOFAS
 *   npx tsx scripts/import-starline.ts --only=tobi    # alleen Tobi
 */

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
const STARLINE_BASE = "https://www.starlinemeubel.nl/assets/images/Banken/";
const HERO_W = 2000;
const CROP_SIZE = 1000;

// Default "modern luxe living room" prompt voor banken zonder eigen scenePrompt.
// BELANGRIJK: alleen architectuur (muren/vloer/raam/licht) noemen, GEEN meubels.
// Anders gaat e_gen_background_replace de bank zelf ook aanpassen.
// Komma's vermijden — Cloudinary URL-parser kan ze niet altijd correct lezen
// in een gechainede transformatie.
const DEFAULT_SCENE_PROMPT =
  "modern luxe living room interior soft cream painted walls polished light oak wood floor tall windows with soft natural daylight neutral cream palette premium interior photography";

interface SourceSofa {
  name: string;          // gebruikt voor file-probe (bv. "Tobi" → Tobi.jpeg / Tobi.jpg / Tobi.png)
  price: number;
  description?: string;
  scenePrompt?: string;  // optioneel — overschrijft DEFAULT_SCENE_PROMPT voor deze bank
}

const TEST_SOFAS: SourceSofa[] = [
  {
    name: "Tobi",
    price: 1799,
    description:
      "Strakke lijnen ontmoeten zachte texturen. Een statement-bank met sculpturale armleuningen, gemaakt voor lange avonden en stille ochtenden.",
    // Tobi: warm contemporary — architecturale prompt zonder meubels
    scenePrompt:
      "modern luxe living room interior with curved arched alcove warm beige plaster walls light oak wood floor large windows with soft natural daylight neutral cream palette premium interior photography",
  },
  {
    name: "Sanchez",
    price: 1499,
    description:
      "Modulaire eenvoud met diepte. Sanchez combineert minimalisme met genereus zitcomfort — een rustpunt in elk interieur.",
    // Sanchez: modern minimalist met herringbone vloer
    scenePrompt:
      "modern minimalist living room cream painted walls herringbone oak parquet floor large windows with soft natural daylight neutral palette premium interior photography",
  },
  {
    name: "Memory",
    price: 2199,
    description:
      "Royale L-vorm in zachte stoffering. Memory verandert de hoek van je kamer in een lounge — zonder concessies aan stijl.",
    // Memory: architectural modern — gewone witte muren met polished oak
    scenePrompt:
      "modern minimalist living room soft white plaster walls polished light oak wood floor floor-to-ceiling windows soft natural daylight neutral cream palette premium interior photography",
  },
];

const EXTENSIONS = ["jpeg", "jpg", "JPG", "png", "webp"];

async function findSourceUrl(name: string): Promise<string> {
  for (const ext of EXTENSIONS) {
    const url = `${STARLINE_BASE}${name}.${ext}`;
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return url;
  }
  throw new Error(`geen geldige extensie gevonden voor ${name}`);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function parseArgs(): { only?: string } {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
  return { only };
}

async function uploadRaw(sourceUrl: string, slug: string): Promise<string> {
  const r = await cloudinary.uploader.upload(sourceUrl, {
    public_id: `mokka/_raw/starline/${slug}`,
    overwrite: true,
    resource_type: "image",
  });
  return r.public_id;
}

async function fetchHeroScene(rawPublicId: string, scenePrompt: string): Promise<Buffer> {
  // Encode prompt — alleen spaties als %20 (geen komma's, die brak Cloudinary's parser)
  const prompt = encodeURIComponent(scenePrompt).replace(/%2C/g, "%20");
  // Pipeline-volgorde:
  //   1. e_background_removal → isoleer de bank zodat gen niet de bank-vorm hertekent
  //   2. e_upscale → AI super-res voor scherpe details
  //   3. c_pad,ar_1:1,b_auto → vierkant maken met edge-aware fill
  //   4. e_gen_background_replace → AI-woonkamer rondom de cutout-bank
  //   5. e_sharpen:80 → extra crispness na gen
  //   6. w_2000,q_95,f_jpg → 2000px output met minimale compressie
  const url = `https://res.cloudinary.com/${CLOUD}/image/upload/e_background_removal/e_upscale/c_pad,ar_1:1,b_auto/e_gen_background_replace:prompt_${prompt}/e_sharpen:80/w_${HERO_W},q_95,f_jpg/${rawPublicId}.jpg`;
  // Eerste gen-request kan ~10-20s duren — retry met backoff
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (attempt < 7) {
      console.log(`    gen-bg pending (${res.status}), retry in ${5 + attempt * 2}s...`);
      await new Promise((r) => setTimeout(r, (5 + attempt * 2) * 1000));
    } else {
      throw new Error(`gen-bg failed: ${res.status}`);
    }
  }
  throw new Error("unreachable");
}

async function makeDetailCrops(hero: Buffer): Promise<Buffer[]> {
  const heroMeta = await sharp(hero).metadata();
  const w = heroMeta.width!;
  const h = heroMeta.height!;

  // Drie 800x800 crops: links / midden / rechts
  const verticalCenter = Math.floor(h * 0.5);
  const top = Math.max(0, verticalCenter - CROP_SIZE / 2);

  const regions = [
    { left: 0, top },
    { left: Math.floor((w - CROP_SIZE) / 2), top },
    { left: w - CROP_SIZE, top },
  ];

  return Promise.all(
    regions.map((r) =>
      sharp(hero)
        .extract({ ...r, width: CROP_SIZE, height: CROP_SIZE })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer(),
    ),
  );
}

interface UploadResult {
  url: string;
  w: number;
  h: number;
}

async function uploadBuffer(buf: Buffer, publicId: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: "image", overwrite: true },
      (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error("geen upload-result"));
        resolve({ url: result.secure_url, w: result.width, h: result.height });
      },
    );
    stream.end(buf);
  });
}

async function processOne(sofa: SourceSofa): Promise<void> {
  const slug = slugify(`${sofa.name} bank`);
  const t0 = Date.now();
  console.log(`\n[${sofa.name}]`);

  console.log(`  zoek bron...`);
  const sourceUrl = await findSourceUrl(sofa.name);
  console.log(`    ${sourceUrl}`);

  console.log(`  upload raw...`);
  const rawId = await uploadRaw(sourceUrl, slug);
  console.log(`    ${rawId}`);

  console.log(`  gen-bg scene...`);
  const prompt = sofa.scenePrompt ?? DEFAULT_SCENE_PROMPT;
  const hero = await fetchHeroScene(rawId, prompt);
  console.log(`    hero ${(hero.length / 1024).toFixed(0)} kB`);

  const crops = await makeDetailCrops(hero);

  console.log(`  upload final...`);
  const heroUp = await uploadBuffer(hero, `mokka/banken/${slug}/hero`);
  const cropsUp = await Promise.all(
    crops.map((c, i) => uploadBuffer(c, `mokka/banken/${slug}/detail-${i + 1}`)),
  );

  const images = [heroUp, ...cropsUp].map((u) => ({ url: u.url, w: u.w, h: u.h }));

  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    await prisma.product.update({
      where: { slug },
      data: { images: JSON.stringify(images), price: sofa.price },
    });
    console.log(`    DB: geüpdatet`);
  } else {
    await prisma.product.create({
      data: {
        slug,
        name: `${sofa.name} Bank`,
        description: sofa.description ?? "",
        price: sofa.price,
        category: "banken",
        images: JSON.stringify(images),
        featured: false,
        stock: 5,
        deliveryTime: "4-6 weken",
        specs: JSON.stringify({
          Afmetingen: "220 × 90 × 80 cm",
          Materiaal: "Premium stoffen bekleding",
          Frame: "Massief hardhout",
          Levertijd: "4-6 weken",
        }),
      },
    });
    console.log(`    DB: aangemaakt`);
  }

  console.log(`  klaar in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

async function main() {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("Cloudinary credentials ontbreken in .env.local");
    process.exit(1);
  }

  const { only } = parseArgs();
  let list = TEST_SOFAS;
  if (only) {
    list = TEST_SOFAS.filter(
      (s) =>
        slugify(s.name) === only.toLowerCase() ||
        slugify(`${s.name} bank`) === only.toLowerCase(),
    );
  }

  if (list.length === 0) {
    console.error(`Geen banken gevonden voor --only=${only}`);
    process.exit(1);
  }

  console.log(`Processing ${list.length} bank(en)...`);
  for (const sofa of list) {
    try {
      await processOne(sofa);
    } catch (e) {
      console.error(`  FOUT bij ${sofa.name}: ${(e as Error).message}`);
    }
  }
  console.log(`\nKlaar`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
