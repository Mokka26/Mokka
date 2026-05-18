// Import banks from wetransfer folders.
//
// Verwacht: ergens in public/wetransfer_xxx/.../<FolderName>/ liggen
//   - Copilot_*.png   door user toegevoegd, gebruik eerst (hero + scenes)
//   - <Bank>.png      originele productfoto's
//   - Allinhouse*, *specificat*, *size edit*, *charm*, *.psd, etc -> skip
//
// Per folder:
//   1. Lees alle bestanden, sorteer ze: Copilot eerst (op timestamp), dan rest alfabetisch
//   2. Genereer product-naam uit folder (strip " cc"/" c" suffix)
//   3. Match tegen bestaand product in DB (op slug-tokens)
//   4. Upload alle relevante foto's naar Cloudinary onder:
//        mokka/<category>/<slug>/copilot-1, copilot-2, photo-1, photo-2, ...
//   5. Update Product: name (cleaned) + images (JSON {url,w,h}[])
//
// Run:
//   npx tsx scripts/import-from-folders.ts                       # dry-run alles
//   npx tsx scripts/import-from-folders.ts --apply               # alles uploaden
//   npx tsx scripts/import-from-folders.ts --slug=bolton-riviera-hoekbank --apply
//
// Flags:
//   --apply               echte upload + DB-write (default: dry-run)
//   --slug=<slug>         alleen deze ene
//   --skip-cloudinary     alleen DB updaten (gebruik bestaande Cloudinary URLs)
//   --keep-name           bestaande DB-naam behouden (alleen images updaten)

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const SKIP_CLD = args.includes("--skip-cloudinary");
const KEEP_NAME = args.includes("--keep-name");
const INCLUDE_NO_COPILOT = args.includes("--include-no-copilot");
const onlySlug = args.find((a) => a.startsWith("--slug="))?.split("=")[1];

const PUBLIC_DIR = path.join(process.cwd(), "public");

// ─── Bestand-filters ────────────────────────────────────────────────
const SKIP_PATTERN =
  /specificat|size\s?edit|banner|preview|allinhouse|charm|watermerk|_maten|kopie|edit\.png$/i;
const KEEP_EXT = /\.(png|jpe?g|webp)$/i;
const COPILOT_PATTERN = /^Copilot_/i;

// ─── Folder → product naam ──────────────────────────────────────────
function cleanFolderName(folderName: string): string {
  // "Hoekbank Bolton (Riviera) cc" → "Hoekbank Bolton (Riviera)"
  // "Loungebank Star (Preston) c"  → "Loungebank Star (Preston)"
  // "americano"                    → "Americano Bank"
  // "ares u"                       → "Ares U Bank"
  let clean = folderName.replace(/\s+c+\s*$/i, "").trim();
  // Capitalize woorden
  clean = clean.replace(/\b(\w)/g, (m) => m.toUpperCase());
  // Capitalize ook content tussen haakjes
  clean = clean.replace(/\(([^)]+)\)/g, (_, inner: string) => {
    const cap = inner.replace(/\b(\w)/g, (m: string) => m.toUpperCase());
    return `(${cap})`;
  });
  // Voor enkelwoord-folders ("Americano"), append "Bank" als er geen type-woord in zit
  const hasType = /hoekbank|loungebank|u-?bank|bankstel|set/i.test(clean);
  if (!hasType && !clean.toLowerCase().endsWith("bank")) clean += " Bank";
  return clean;
}

function slugTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !["cc", "c", "de", "het", "een"].includes(t));
}

// ─── Cloudinary upload ──────────────────────────────────────────────
type UploadResult = { url: string; w: number; h: number };

async function uploadFile(
  localPath: string,
  publicId: string,
  folder: string,
): Promise<UploadResult> {
  const result = await cloudinary.uploader.upload(localPath, {
    public_id: publicId,
    folder,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
    quality: "auto:best",
    fetch_format: "auto",
  });
  return { url: result.secure_url, w: result.width, h: result.height };
}

// ─── Folder scanner ─────────────────────────────────────────────────
type Candidate = {
  folderPath: string;
  folderName: string;
  copilotFiles: string[];
  otherFiles: string[];
};

async function findFolders(): Promise<Candidate[]> {
  const result: Candidate[] = [];
  const wetransferDirs = (await fs.readdir(PUBLIC_DIR)).filter((d) =>
    d.startsWith("wetransfer_"),
  );

  for (const wtDir of wetransferDirs) {
    const fullWt = path.join(PUBLIC_DIR, wtDir);
    await walkForFolders(fullWt, result);
  }
  return result;
}

async function walkForFolders(dir: string, out: Candidate[], depth = 0): Promise<void> {
  if (depth > 4) return;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  // Heeft deze folder Copilot-bestanden? Of (met --include-no-copilot) productfoto's?
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const copilots = files.filter((f) => COPILOT_PATTERN.test(f) && KEEP_EXT.test(f));
  const others = files
    .filter((f) => KEEP_EXT.test(f) && !COPILOT_PATTERN.test(f) && !SKIP_PATTERN.test(f))
    .sort();
  const shouldInclude = copilots.length > 0 || (INCLUDE_NO_COPILOT && others.length >= 1);
  if (shouldInclude) {
    out.push({
      folderPath: dir,
      folderName: path.basename(dir),
      copilotFiles: copilots.sort(),
      otherFiles: others,
    });
  }

  // Recurse subdirs
  for (const e of entries) {
    if (e.isDirectory()) await walkForFolders(path.join(dir, e.name), out, depth + 1);
  }
}

// ─── Match folder → existing product slug ───────────────────────────
type Product = { id: string; slug: string; name: string; category: string };

function categoryHint(folder: Candidate): string | null {
  const lower = folder.folderName.toLowerCase();
  if (/^hoekbank\b/.test(lower)) return "hoekbanken";
  if (/^(loungebank|u-?bank)\b/.test(lower)) return "banken";
  // Pad-hint: ergens in pad "/banken/" → banken
  if (/[\\/]banken[\\/]/i.test(folder.folderPath)) return "banken";
  return null;
}

function matchProduct(folder: Candidate, products: Product[]): Product | null {
  const folderTokens = new Set(slugTokens(folder.folderName));
  const hint = categoryHint(folder);

  // Filter eerst op category-hint (indien aanwezig)
  const pool = hint ? products.filter((p) => p.category === hint) : products;
  if (pool.length === 0) return null;

  let best: { p: Product; score: number } | null = null;
  for (const p of pool) {
    const slugSet = new Set(slugTokens(p.slug));
    let overlap = 0;
    for (const t of folderTokens) if (slugSet.has(t)) overlap += 1;
    if (overlap === 0) continue;

    let extrasInSlug = 0;
    for (const t of slugSet) if (!folderTokens.has(t)) extrasInSlug += 1;
    let extrasInFolder = 0;
    for (const t of folderTokens) if (!slugSet.has(t)) extrasInFolder += 1;

    // overlap is hoofd-signaal; penalty voor mismatched tokens
    const score = overlap - extrasInSlug * 0.35 - extrasInFolder * 0.1;
    if (!best || score > best.score) best = { p, score };
  }

  if (!best) return null;
  // Minstens 1 niet-generiek token moet overlappen
  const generic = new Set(["bank", "hoekbank", "loungebank", "ubank"]);
  const folderSpecific = [...folderTokens].filter((t) => !generic.has(t));
  const slugSpecific = new Set(slugTokens(best.p.slug).filter((t) => !generic.has(t)));
  const overlap = folderSpecific.filter((t) => slugSpecific.has(t)).length;
  if (overlap < 1) return null;
  return best.p;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log(`\n═══ Import from folders ═══`);
  console.log(`  Apply:        ${APPLY ? "YES (writes Cloudinary+DB)" : "no (dry-run)"}`);
  console.log(`  Only slug:    ${onlySlug ?? "(alle)"}\n`);

  const folders = await findFolders();
  console.log(`Gevonden: ${folders.length} folders met Copilot-foto's\n`);

  const products = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, category: true },
  });

  type Plan = {
    folder: Candidate;
    product: Product | null;
    newName: string;
    cldFolder: string;
    uploads: { localPath: string; publicId: string; kind: "copilot" | "photo" }[];
  };

  const plans: Plan[] = [];
  for (const f of folders) {
    const product = matchProduct(f, products);
    const newName = cleanFolderName(f.folderName);
    const slug = product?.slug ?? "UNMATCHED";
    const cldFolder = product
      ? `mokka/${product.category}/${product.slug}`
      : `mokka/unmatched/${slug}`;
    const uploads: Plan["uploads"] = [];
    f.copilotFiles.forEach((file, i) =>
      uploads.push({
        localPath: path.join(f.folderPath, file),
        publicId: `copilot-${i + 1}`,
        kind: "copilot",
      }),
    );
    f.otherFiles.forEach((file, i) =>
      uploads.push({
        localPath: path.join(f.folderPath, file),
        publicId: `photo-${i + 1}`,
        kind: "photo",
      }),
    );
    plans.push({ folder: f, product, newName, cldFolder, uploads });
  }

  // Print plan
  console.log(`─── Plan ─────────────────────────────────────────`);
  for (const plan of plans) {
    if (onlySlug && plan.product?.slug !== onlySlug) continue;
    const matched = plan.product
      ? `→ ${plan.product.slug} [${plan.product.category}]`
      : `→ (geen match)`;
    console.log(`\n${plan.folder.folderName}`);
    console.log(`  ${matched}`);
    console.log(`  naam: "${plan.product?.name ?? "?"}" → "${plan.newName}"${KEEP_NAME ? " (skipped, --keep-name)" : ""}`);
    console.log(`  cld:  ${plan.cldFolder}/`);
    console.log(`  uploads (${plan.uploads.length}):`);
    plan.uploads.forEach((u, i) =>
      console.log(`    [${i}] ${u.kind.padEnd(7)} ${path.basename(u.localPath)}  →  ${u.publicId}`),
    );
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Geen Cloudinary upload + geen DB-write. Run met --apply.`);
    return;
  }

  // ─── Execute ──────────────────────────────────────────────────────
  console.log(`\n─── Uploading + DB updates ───────────────────────`);
  for (const plan of plans) {
    if (onlySlug && plan.product?.slug !== onlySlug) continue;
    if (!plan.product) {
      console.log(`  · SKIP ${plan.folder.folderName} (geen match)`);
      continue;
    }
    console.log(`\n▶ ${plan.product.slug}`);

    const images: { url: string; w: number; h: number }[] = [];
    if (!SKIP_CLD) {
      for (const u of plan.uploads) {
        try {
          const r = await uploadFile(u.localPath, u.publicId, plan.cldFolder);
          images.push(r);
          console.log(`    ✓ ${u.publicId}  (${r.w}×${r.h})`);
        } catch (e) {
          console.error(`    ✗ ${u.publicId}: ${(e as Error).message}`);
        }
      }
    }

    if (images.length === 0 && !SKIP_CLD) {
      console.error(`    Geen uploads gelukt, DB niet bijgewerkt.`);
      continue;
    }

    const data: { images?: string; name?: string } = {};
    if (images.length > 0) data.images = JSON.stringify(images);
    if (!KEEP_NAME) data.name = plan.newName;

    if (Object.keys(data).length === 0) continue;

    await prisma.product.update({ where: { id: plan.product.id }, data });
    console.log(`    ✓ DB: ${images.length} foto's${KEEP_NAME ? "" : `, naam → "${plan.newName}"`}`);
  }

  console.log(`\n✓ Klaar.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
