/**
 * Sfeerbeelden (product in een ingerichte kamer) toevoegen als foto 1.
 *
 * De originele leveranciersfoto's blijven staan en schuiven één plek op.
 * Het sfeerbeeld krijgt `bg: "scene"` zodat de site het slim bijsnijdt
 * (zie lib/imageHelpers.ts → frameMode). Bronbestanden (4K PNG, 20-30 MB)
 * worden eerst met sharp verkleind tot max. 2400 px en als JPEG geüpload;
 * Cloudinary weigert anders de upload.
 *
 * Gebruik:
 *   npx tsx scripts/add-scene-images.ts list --category=hoekbanken,bankstellen
 *       → zichtbare producten met slug, voorraad, aantal foto's en foto 1
 *   npx tsx scripts/add-scene-images.ts find "Ares Bank" "Crea Kledingkast"
 *       → slugs zoeken op (deel van) de productnaam
 *   npx tsx scripts/add-scene-images.ts apply --manifest=pad/naar/manifest.json [--apply]
 *       → manifest: [{ "slug": "...", "file": "C:/.../hoekbanken-v2.png" }, ...]
 *         zonder --apply alleen controleren (dry-run), geen upload, geen DB-write.
 *
 * Idempotent: bestaat er al een sfeerbeeld (public_id eindigt op /sfeer-01),
 * dan wordt het overschreven op Cloudinary en vervangen in de DB, niet
 * nogmaals toegevoegd.
 */

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { parseImages, type ProductImage } from "../lib/imageHelpers";

config({ path: ".env.local" });

const prisma = new PrismaClient();

const MAX_EDGE = 2400;
const JPEG_QUALITY = 88;
const SCENE_SUFFIX = "/sfeer-01";

type ManifestEntry = { slug: string; file: string };

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function isSceneUrl(url: string): boolean {
  return /\/sfeer-01(\.[a-z0-9]+)?$/i.test(url.split("?")[0]);
}

async function listProducts(categories: string[]): Promise<void> {
  const products = await prisma.product.findMany({
    where: { category: { in: categories }, hidden: false, deletedAt: null },
    orderBy: [{ category: "asc" }, { sortOrder: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: { slug: true, name: true, category: true, stock: true, images: true },
  });
  console.log(`${products.length} zichtbare producten in ${categories.join(", ")}\n`);
  for (const p of products) {
    const imgs = parseImages(p.images);
    const first = imgs[0];
    const hasScene = imgs.some((i) => isSceneUrl(i.url));
    console.log(
      [
        p.category.padEnd(12),
        p.slug.padEnd(52),
        `stock=${String(p.stock).padStart(3)}`,
        `foto's=${String(imgs.length).padStart(2)}`,
        hasScene ? "SFEER ✓" : "       ",
        first ? `${first.bg ?? "?"} ${first.url}` : "(geen foto)",
      ].join("  "),
    );
  }
}

async function findProducts(terms: string[]): Promise<void> {
  for (const term of terms) {
    const hits = await prisma.product.findMany({
      where: { name: { contains: term, mode: "insensitive" }, deletedAt: null },
      select: { slug: true, name: true, category: true, hidden: true },
      take: 10,
    });
    console.log(`\n"${term}" → ${hits.length} treffer(s)`);
    for (const h of hits) {
      console.log(`  ${h.hidden ? "[verborgen] " : ""}${h.category}/${h.slug}   (${h.name})`);
    }
  }
}

/**
 * Referentiefoto voor de beeldgeneratie: liefst een vrijstaande foto
 * (`bg: "plain"`) die geen eerder AI-beeld is (copilot/chatgpt/sfeer in de
 * naam); anders de eerste niet-AI foto; anders foto 1.
 */
function pickReference(images: ProductImage[]): ProductImage | undefined {
  const isAi = (i: ProductImage) => /copilot|chatgpt|sfeer-01/i.test(i.url);
  return (
    images.find((i) => i.bg === "plain" && !isAi(i)) ??
    images.find((i) => !isAi(i)) ??
    images[0]
  );
}

async function listPhotos(slugs: string[]): Promise<void> {
  for (const slug of slugs) {
    const p = await prisma.product.findUnique({ where: { slug }, select: { slug: true, images: true } });
    if (!p) {
      console.log(`✗ ${slug}: niet gevonden`);
      continue;
    }
    console.log(`\n${slug}`);
    parseImages(p.images).forEach((img, i) => console.log(`  ${i}  ${(img.bg ?? "?").padEnd(5)}  ${img.url}`));
  }
}

/** Handmatige referentiekeuze: { "<slug>": <foto-index> } (0-gebaseerd). */
function readOverrides(file: string | undefined): Record<string, number> {
  if (!file) return {};
  const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Override moet een object zijn");
  const out: Record<string, number> = {};
  for (const [slug, idx] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0) throw new Error(`Override ${slug}: ongeldige index`);
    out[slug] = idx;
  }
  return out;
}

async function exportReferences(categories: string[], outDir: string, overrides: Record<string, number>): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  const products = await prisma.product.findMany({
    where: { category: { in: categories }, hidden: false, deletedAt: null },
    orderBy: [{ category: "asc" }, { sortOrder: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: { slug: true, name: true, category: true, images: true },
  });
  const manifest: Array<{ slug: string; name: string; category: string; ref: string; bg: string; file: string }> = [];
  for (const p of products) {
    const imgs = parseImages(p.images);
    if (imgs.some((i) => isSceneUrl(i.url))) {
      console.log(`– ${p.slug}: heeft al een sfeerbeeld, overgeslagen`);
      continue;
    }
    const override = overrides[p.slug];
    const ref = override !== undefined ? imgs[override] : pickReference(imgs);
    if (!ref) {
      console.log(`✗ ${p.slug}: geen foto${override !== undefined ? ` op index ${override}` : ""}`);
      continue;
    }
    const file = path.join(outDir, `${p.slug}.jpg`);
    if (override !== undefined || !fs.existsSync(file)) {
      const res = await fetch(ref.url);
      if (!res.ok) {
        console.log(`✗ ${p.slug}: download mislukt (${res.status})`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toFile(file);
    }
    manifest.push({ slug: p.slug, name: p.name, category: p.category, ref: ref.url, bg: ref.bg ?? "?", file });
    console.log(`✓ ${p.category}/${p.slug}  ${ref.bg ?? "?"}  ${ref.url}`);
  }
  const manifestPath = path.join(outDir, "refs.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`\n${manifest.length} referenties → ${manifestPath}`);
}

async function prepareJpeg(file: string, tmpDir: string): Promise<{ path: string; w: number; h: number }> {
  const out = path.join(tmpDir, `${path.basename(file, path.extname(file))}.jpg`);
  const info = await sharp(file)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(out);
  return { path: out, w: info.width, h: info.height };
}

async function applyManifest(manifestPath: string, apply: boolean): Promise<void> {
  if (apply && (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)) {
    throw new Error("CLOUDINARY_API_KEY en CLOUDINARY_API_SECRET ontbreken in .env.local");
  }
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  const raw: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("Manifest moet een JSON-array zijn");
  const entries: ManifestEntry[] = raw.map((item: unknown, i) => {
    if (!item || typeof item !== "object") throw new Error(`Manifest item ${i} is geen object`);
    const rec = item as Record<string, unknown>;
    if (typeof rec.slug !== "string" || typeof rec.file !== "string") {
      throw new Error(`Manifest item ${i} mist slug of file`);
    }
    return { slug: rec.slug, file: rec.file };
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mokka-scene-"));
  console.log(`${apply ? "APPLY" : "DRY-RUN"} — ${entries.length} sfeerbeelden, tijdelijke map ${tmpDir}\n`);

  let done = 0;
  for (const entry of entries) {
    if (!fs.existsSync(entry.file)) {
      console.log(`✗ ${entry.slug}: bestand ontbreekt (${entry.file})`);
      continue;
    }
    const product = await prisma.product.findUnique({
      where: { slug: entry.slug },
      select: { id: true, slug: true, name: true, category: true, images: true },
    });
    if (!product) {
      console.log(`✗ ${entry.slug}: product niet gevonden`);
      continue;
    }

    const existing = parseImages(product.images);
    const alreadyAt = existing.findIndex((i) => isSceneUrl(i.url));
    const jpeg = await prepareJpeg(entry.file, tmpDir);
    const sizeMb = (fs.statSync(jpeg.path).size / 1e6).toFixed(1);
    const publicId = `mokka/${product.category}/${product.slug}${SCENE_SUFFIX}`;

    console.log(
      `${apply ? "→" : "·"} ${product.category}/${product.slug}  ${jpeg.w}×${jpeg.h} ${sizeMb} MB  ` +
        `${alreadyAt >= 0 ? `vervangt sfeerbeeld op positie ${alreadyAt + 1}` : `nieuw als foto 1 (nu ${existing.length} foto's)`}`,
    );
    if (!apply) continue;

    const uploaded = await cloudinary.uploader.upload(jpeg.path, {
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
    });

    const scene: ProductImage = {
      url: uploaded.secure_url,
      w: uploaded.width,
      h: uploaded.height,
      alt: `${product.name} in een ingerichte kamer`,
      bg: "scene",
    };
    const rest = existing.filter((_, i) => i !== alreadyAt);
    await prisma.product.update({
      where: { id: product.id },
      data: { images: JSON.stringify([scene, ...rest]) },
    });
    done++;
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\nKlaar: ${done} product(en) bijgewerkt${apply ? "" : " (dry-run, niets gewijzigd)"}.`);
  if (apply && done > 0) {
    console.log("Let op: homepage en categoriepagina's zijn ISR (1 uur); productpagina's tonen het direct na revalidate.");
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "list") {
    const cats = (arg("category") ?? "hoekbanken,bankstellen,banken").split(",").map((s) => s.trim()).filter(Boolean);
    await listProducts(cats);
    return;
  }
  if (mode === "refs") {
    const cats = (arg("category") ?? "hoekbanken,bankstellen,banken").split(",").map((s) => s.trim()).filter(Boolean);
    const out = arg("out");
    if (!out) throw new Error("--out=map ontbreekt");
    await exportReferences(cats, path.resolve(out), readOverrides(arg("override")));
    return;
  }
  if (mode === "photos") {
    const slugs = process.argv.slice(3).filter((a) => !a.startsWith("--"));
    if (slugs.length === 0) throw new Error("Geef één of meer slugs op");
    await listPhotos(slugs);
    return;
  }
  if (mode === "find") {
    const terms = process.argv.slice(3).filter((a) => !a.startsWith("--"));
    if (terms.length === 0) throw new Error("Geef één of meer zoektermen op");
    await findProducts(terms);
    return;
  }
  if (mode === "apply") {
    const manifest = arg("manifest");
    if (!manifest) throw new Error("--manifest=pad.json ontbreekt");
    await applyManifest(path.resolve(manifest), hasFlag("apply"));
    return;
  }
  console.log("Gebruik: list | refs --out=map [--override=pad.json] | photos <slug...> | find <naam...> | apply --manifest=pad.json [--apply]");
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
