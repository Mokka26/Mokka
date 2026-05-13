/**
 * Importeer banken uit catalogus 25.pdf met AI-gegenereerde moderne woonkamer-scenes.
 *
 * Pipeline per bank:
 *   1. Render PDF-pagina als hoge-resolutie PNG (scale 3.0 → ~2520px)
 *   2. Crop rechter ~70% (blue info-panel weg)
 *   3. Upload als raw asset naar Cloudinary
 *   4. Apply chained transforms:
 *      e_background_removal → e_upscale → c_pad,ar_1:1,b_auto
 *      → e_gen_background_replace → e_sharpen:80 → w_2000,q_95
 *   5. Upload hero + 3 detail-crops
 *   6. Insert/update product in DB met specs uit PDF
 *
 * Gebruik:
 *   npx tsx scripts/import-from-pdf-banken.ts                  # alle banken
 *   npx tsx scripts/import-from-pdf-banken.ts --only=bolton-new
 *   npx tsx scripts/import-from-pdf-banken.ts --pages=14,17,20  # specifieke pagina's
 *   npx tsx scripts/import-from-pdf-banken.ts --limit=3         # eerste 3 voor test
 */

import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";

config({ path: ".env.local" });

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;

const PDF_PATH = "public/catalogus 25.pdf";
const SCALE = 3.0;
const PHOTO_LEFT_PCT = 0.30;     // blauw info-panel neemt links ~30% van pagina
const HERO_W = 2000;
const CROP_SIZE = 1000;

// Modern luxe living room — alleen architectuur (anders herinterpreteert gen de bank)
const SCENE_PROMPT =
  "modern luxe living room interior soft cream painted walls polished light oak wood floor large windows with soft natural daylight neutral cream palette premium interior photography";

interface ParsedBank {
  page: number;
  name: string;            // "Bolton New", "Bastia", etc.
  voorraadKleur?: string;  // "Feel Me 01", "Mystery 17"
  opstelling?: string;
  zittingen?: string;
  arm?: string;
  hoek?: string;
  totaalAfmeting?: string;
  rawText: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string) => args.find((a) => a.startsWith(`--${key}=`))?.split("=")[1];
  return {
    only: get("only"),
    pages: get("pages")?.split(",").map((n) => parseInt(n, 10)),
    limit: get("limit") ? parseInt(get("limit")!, 10) : undefined,
  };
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function parsePage(text: string, page: number): ParsedBank | null {
  if (!text.includes("Opstelling") && !text.includes("Hoek:") && !text.includes("Zittingen:")) {
    return null;
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let name: string | null = null;
  for (const l of lines) {
    if (
      !l.startsWith("Opstelling") && !l.startsWith("Voorraad") && !l.startsWith("Zittingen") &&
      !l.startsWith("Arm:") && !l.startsWith("Hoek:") && !l.startsWith("OTM") && !l.startsWith("OTT") &&
      !l.startsWith("Totaal") && !l.startsWith("Poef:") && !l.startsWith("2zit") && !l.startsWith("Maat:") &&
      !l.match(/^\d+(\.\d+)?(cm|CM)/) && !l.match(/^[A-Z]+\+/) &&
      l.length >= 3 && l.length < 50
    ) {
      name = l;
      break;
    }
  }
  if (!name) return null;

  const find = (key: string) => {
    const re = new RegExp(`${key}\\s*:?\\s*(.+)`, "i");
    const m = text.match(re);
    return m?.[1]?.split("\n")[0]?.trim();
  };

  return {
    page, name,
    voorraadKleur: find("Voorraad Kleur"),
    opstelling: find("Opstelling"),
    zittingen: find("Zittingen"),
    arm: find("Arm"),
    hoek: find("Hoek"),
    totaalAfmeting: find("Totaal Afmeting"),
    rawText: text,
  };
}

async function loadAllBanken(): Promise<ParsedBank[]> {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const { PDFParse } = require("pdf-parse");

  const buf = await readFile(PDF_PATH);
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();

  const banken: ParsedBank[] = [];
  for (let i = 0; i < (result.pages?.length ?? 0); i++) {
    const text: string = (result.pages![i].text ?? "").trim();
    const parsed = parsePage(text, i + 1);
    if (parsed) banken.push(parsed);
  }
  return banken;
}

// Hergebruik 1 PDFParse instance — getScreenshot kan multi-page renderen
let pdfParserInstance: { getScreenshot: (opts: object) => Promise<unknown> } | null = null;

async function getPdfParser() {
  if (!pdfParserInstance) {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const { PDFParse } = require("pdf-parse");
    const buf = await readFile(PDF_PATH);
    pdfParserInstance = new PDFParse({ data: buf });
  }
  return pdfParserInstance!;
}

interface ScreenshotResult {
  pages?: Array<{ pageNumber: number; canvas?: { toBuffer: (mime: string) => Buffer; data?: Uint8Array }; data?: Uint8Array }>;
}

async function renderPage(pageNum: number): Promise<Buffer> {
  const parser = await getPdfParser();
  const result = (await parser.getScreenshot({
    scale: SCALE,
    first: pageNum,
    last: pageNum,
  })) as ScreenshotResult;

  const page = result.pages?.[0];
  if (!page) throw new Error(`getScreenshot gaf geen pagina terug voor p.${pageNum}`);

  // Probeer verschillende return-formats — pdf-parse v2 kan canvas, data, of buffer geven
  if (page.canvas?.toBuffer) {
    return page.canvas.toBuffer("image/png");
  }
  if (page.data) {
    return Buffer.from(page.data);
  }
  if (page.canvas?.data) {
    return Buffer.from(page.canvas.data);
  }
  throw new Error(`onbekend screenshot format: ${JSON.stringify(Object.keys(page))}`);
}

async function cropBankPhoto(pagePng: Buffer): Promise<Buffer> {
  const meta = await sharp(pagePng).metadata();
  const left = Math.floor(meta.width! * PHOTO_LEFT_PCT);
  return sharp(pagePng)
    .extract({
      left,
      top: 0,
      width: meta.width! - left,
      height: meta.height!,
    })
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();
}

async function uploadRawBuffer(buf: Buffer, slug: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: `mokka/_raw/pdf/${slug}`, resource_type: "image", overwrite: true },
      (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error("no upload result"));
        resolve(result.public_id);
      },
    );
    stream.end(buf);
  });
}

async function fetchHeroScene(rawPublicId: string): Promise<Buffer> {
  const prompt = encodeURIComponent(SCENE_PROMPT).replace(/%2C/g, "%20");
  // Pipeline:
  //   1. e_gen_remove → verwijder watermarks EN alle accessoires (salontafels, vazen,
  //      planten, kleden, gordijnen, vloer, muur) zodat alleen de bank overblijft
  //   2. e_background_removal → isoleer de bank
  //   3. c_pad,ar_1:1,b_auto → vierkant maken
  //   4. e_gen_background_replace → genereer compleet nieuwe modern woonkamer
  //   5. e_sharpen:80 → crispness
  //   6. w_2000,q_95,f_jpg → 2000px output
  // (e_upscale weggelaten — PDF source is al hoge res, anders Cloudinary 25 MP limiet)
  const removeItems = "coffee%20table%20side%20table%20vase%20flowers%20plants%20rug%20text%20watermark%20brand%20name%20floor%20wall%20curtain";
  const url = `https://res.cloudinary.com/${CLOUD}/image/upload/e_gen_remove:prompt_(${removeItems})/e_background_removal/c_pad,ar_1:1,b_auto/e_gen_background_replace:prompt_${prompt}/e_sharpen:80/w_${HERO_W},q_95,f_jpg/${rawPublicId}.jpg`;
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
  const meta = await sharp(hero).metadata();
  const w = meta.width!;
  const h = meta.height!;
  const top = Math.max(0, Math.floor(h * 0.5) - CROP_SIZE / 2);
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

function buildSpecs(b: ParsedBank): Record<string, string> {
  const specs: Record<string, string> = {};
  if (b.totaalAfmeting) specs["Afmetingen"] = b.totaalAfmeting;
  if (b.voorraadKleur) specs["Stoffering"] = b.voorraadKleur;
  if (b.opstelling) specs["Opstelling"] = b.opstelling;
  if (b.zittingen) specs["Zitcomfort"] = b.zittingen;
  if (b.arm) specs["Armleuning"] = b.arm;
  if (b.hoek) specs["Hoekmaat"] = b.hoek;
  specs["Levertijd"] = "4-6 weken";
  return specs;
}

function buildDescription(b: ParsedBank): string {
  const colorPart = b.voorraadKleur ? ` in ${b.voorraadKleur} stoffering` : "";
  const sizePart = b.totaalAfmeting ? `Afmeting ${b.totaalAfmeting}.` : "";
  return `${b.name} — een modulaire bank${colorPart} met genereus zitcomfort. ${sizePart} Handgemaakt en op maat.`.trim();
}

interface ProcessResult { slug: string; ok: boolean; error?: string; }

async function processBank(b: ParsedBank, dedupeIdx: number): Promise<ProcessResult> {
  const baseSlug = slugify(`${b.name} bank`);
  // Bij duplicaten: voeg page-num als suffix
  const slug = dedupeIdx === 0 ? baseSlug : `${baseSlug}-p${b.page}`;
  const t0 = Date.now();
  console.log(`\n[p.${b.page} ${b.name}${dedupeIdx > 0 ? ` (dupe #${dedupeIdx})` : ""}]`);

  try {
    console.log(`  render PDF...`);
    const pagePng = await renderPage(b.page);
    console.log(`    ${(pagePng.length / 1024).toFixed(0)} kB`);

    console.log(`  crop bank photo...`);
    const photo = await cropBankPhoto(pagePng);
    console.log(`    ${(photo.length / 1024).toFixed(0)} kB`);

    console.log(`  upload raw...`);
    const rawId = await uploadRawBuffer(photo, slug);

    console.log(`  gen-bg scene...`);
    const hero = await fetchHeroScene(rawId);
    console.log(`    hero ${(hero.length / 1024).toFixed(0)} kB`);

    const crops = await makeDetailCrops(hero);
    console.log(`  upload final...`);
    const heroUp = await uploadFinal(hero, `mokka/banken/${slug}/hero`);
    const cropsUp = await Promise.all(
      crops.map((c, i) => uploadFinal(c, `mokka/banken/${slug}/detail-${i + 1}`)),
    );
    const images = [heroUp, ...cropsUp].map((u) => ({ url: u.url, w: u.w, h: u.h }));

    const description = buildDescription(b);
    const specs = buildSpecs(b);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      await prisma.product.update({
        where: { slug },
        data: { images: JSON.stringify(images), description, specs: JSON.stringify(specs) },
      });
      console.log(`    DB: geüpdatet`);
    } else {
      await prisma.product.create({
        data: {
          slug,
          name: `${b.name} Bank`,
          description,
          price: 1499,
          category: "banken",
          images: JSON.stringify(images),
          featured: false,
          stock: 5,
          deliveryTime: "4-6 weken",
          specs: JSON.stringify(specs),
        },
      });
      console.log(`    DB: aangemaakt`);
    }

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
  console.log(`Lees PDF specs...`);
  const allBanken = await loadAllBanken();
  console.log(`  ${allBanken.length} banken gevonden`);

  let toProcess = allBanken;
  if (args.pages) toProcess = toProcess.filter((b) => args.pages!.includes(b.page));
  if (args.only) {
    const target = args.only.toLowerCase();
    toProcess = toProcess.filter((b) =>
      slugify(b.name) === target || slugify(`${b.name} bank`) === target,
    );
  }
  if (args.limit) toProcess = toProcess.slice(0, args.limit);

  if (toProcess.length === 0) {
    console.error(`Geen banken matchen filters`);
    process.exit(1);
  }

  // Dedupe naam-counter (Anna p.7 = #0, Anna p.8 = #1)
  const nameCount = new Map<string, number>();
  console.log(`\nProcessing ${toProcess.length} bank(en)...`);
  const results: ProcessResult[] = [];
  for (const b of toProcess) {
    const idx = nameCount.get(b.name) ?? 0;
    nameCount.set(b.name, idx + 1);
    results.push(await processBank(b, idx));
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Resultaat: ${ok}/${results.length} ok ===`);
  if (failed.length) {
    console.log(`Mislukt:`);
    for (const r of failed) console.log(`  ${r.slug}: ${r.error}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
