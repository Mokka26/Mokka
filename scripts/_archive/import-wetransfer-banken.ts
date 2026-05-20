/**
 * Importeer banken/hoekbanken uit de 3 wetransfer mappen in /public/.
 *
 * Folder 3 (hoekbank-arte-inari): subfolders per hoekbank/loungebank/u-bank,
 *   met PNG vooraanzicht + hoekaanzicht. Schoon te parsen.
 *
 * Folder 2 (finn): mix van subfolders met hoekbanken (PNG) en banken (alleen PSD).
 *   Alleen PNG-bevattende subfolders worden gebruikt.
 *
 * Folder 1 (banken/banken/): flat PNG-bestanden gegroepeerd per basenaam.
 *
 * Pipeline per bank:
 *   1. Upload PNG('s) naar Cloudinary onder mokka/banken/<slug>/
 *   2. Insert/upsert in DB met hidden=false, prijs €1499 (placeholder)
 */

import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const prisma = new PrismaClient();

const FOLDERS = {
  flat: "public/wetransfer_banken_2026-05-05_2016/banken",
  finn: "public/wetransfer_finn_2026-05-05_2021",
  hoek: "public/wetransfer_hoekbank-arte-inari-kongo-cc_2026-05-05_2026",
};

interface BankToImport {
  slug: string;
  name: string;
  category: "banken" | "hoekbanken";
  pngPaths: string[];
  description: string;
  source: string;
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function titleCase(s: string): string {
  return s.toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function isDir(path: string): Promise<boolean> {
  try { return (await stat(path)).isDirectory(); } catch { return false; }
}

// Folder 3 + folder 2 subfolders: "Hoekbank X (Y) cc" patroon
async function processSubfolderStyle(folder: string): Promise<BankToImport[]> {
  const banks: BankToImport[] = [];
  const items = await readdir(folder);
  for (const item of items) {
    const fullPath = join(folder, item);
    if (!(await isDir(fullPath))) continue;
    const files = await readdir(fullPath);
    const pngs = files.filter((f) => f.toLowerCase().endsWith(".png"));
    if (pngs.length === 0) continue;

    // Parse: "Hoekbank Bolton (Riviera) cc" / "Loungebank Star (Croco) cc" / "U-Bank New Bolton (Fresh) cc"
    const m = item.match(/^(Hoekbank|Loungebank|U-Bank)\s+(.+?)(?:\s+cc)?$/i);
    let type = "Bank";
    let baseName = item;
    if (m) { type = m[1]; baseName = m[2].trim(); }
    else {
      // Folder 2 subfolders without prefix: FINN, MOANA, YOLA → bank
      baseName = item.trim();
    }

    const category: "banken" | "hoekbanken" = /^hoekbank$/i.test(type) ? "hoekbanken" : "banken";
    const typeLabel = type === "U-Bank" ? "U-Bank" : type === "Loungebank" ? "Loungebank" : type === "Hoekbank" ? "Hoekbank" : "Bank";
    const name = `${titleCase(baseName)} ${typeLabel}`;
    const slug = slugify(`${baseName}-${typeLabel}`);

    // Sort: vooraanzicht eerst, dan hoekaanzicht, dan rest alfabetisch
    pngs.sort((a, b) => {
      const score = (f: string) =>
        /vooraanzicht/i.test(f) ? 0 :
        /hoekaanzicht/i.test(f) ? 1 :
        /size\s*edit/i.test(f) ? 2 : 3;
      const sA = score(a); const sB = score(b);
      if (sA !== sB) return sA - sB;
      return a.localeCompare(b);
    });

    banks.push({
      slug, name, category,
      pngPaths: pngs.map((f) => join(fullPath, f)),
      description: `${titleCase(baseName)} is een ${typeLabel.toLowerCase()} met sculpturale lijnen en premium stoffering. Handgemaakt met aandacht voor duurzaamheid en zitcomfort, gemaakt om jouw woonkamer karakter te geven.`,
      source: folder.split(/[\\/]/).pop() ?? folder,
    });
  }
  return banks;
}

// Folder 1: flat PNG's, groeperen op basisnaam
async function processFlatStyle(folder: string): Promise<BankToImport[]> {
  const items = await readdir(folder);
  const pngs = items.filter((f) => f.toLowerCase().endsWith(".png"));
  const groups = new Map<string, string[]>();
  for (const f of pngs) {
    // Strip extension, trailing digits, " kopie", spaces
    const base = f
      .toLowerCase()
      .replace(/\.png$/i, "")
      .replace(/\s*kopie\s*\d*$/i, "")
      .replace(/\s+\d+$/, "")
      .replace(/\s+$/, "")
      .trim();
    const arr = groups.get(base) ?? [];
    arr.push(f);
    groups.set(base, arr);
  }

  const banks: BankToImport[] = [];
  for (const [base, files] of groups) {
    if (files.length === 0) continue;
    const isHoek = /\bhoek\b|\bu\s*bank\b/i.test(base);
    const cleanName = base.replace(/\s+hoek\b/i, "").replace(/\bu\s*bank\b/i, "").trim();
    if (!cleanName) continue;
    const displayName = titleCase(cleanName);
    const category: "banken" | "hoekbanken" = isHoek ? "hoekbanken" : "banken";
    const typeLabel = isHoek ? "Hoekbank" : "Bank";
    const slug = slugify(`${cleanName}-${typeLabel}`);

    banks.push({
      slug,
      name: `${displayName} ${typeLabel}`,
      category,
      pngPaths: files.map((f) => join(folder, f)),
      description: `${displayName} ${typeLabel.toLowerCase()} — modulaire vormgeving met focus op zitcomfort en materialiteit. Gemaakt voor het moderne thuis.`,
      source: folder.split(/[\\/]/).pop() ?? folder,
    });
  }
  return banks;
}

interface UploadResult { url: string; w: number; h: number; }

async function uploadFile(path: string, publicId: string): Promise<UploadResult> {
  const r = await cloudinary.uploader.upload(path, {
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
  });
  return { url: r.secure_url, w: r.width, h: r.height };
}

async function processOne(bank: BankToImport): Promise<{ slug: string; ok: boolean; error?: string }> {
  const t0 = Date.now();
  console.log(`\n[${bank.source}] ${bank.name}`);
  console.log(`  cat: ${bank.category} | slug: ${bank.slug} | ${bank.pngPaths.length} foto's`);

  try {
    // Upload max 6 foto's (hero + 5 details)
    const toUpload = bank.pngPaths.slice(0, 6);
    const uploads: UploadResult[] = [];
    for (let i = 0; i < toUpload.length; i++) {
      const label = i === 0 ? "hero" : `detail-${i}`;
      const publicId = `mokka/${bank.category}/${bank.slug}/${label}`;
      const r = await uploadFile(toUpload[i], publicId);
      uploads.push(r);
      console.log(`    ${label}: ${basename(toUpload[i])} → ${(r.w)}x${r.h}`);
    }

    const images = uploads.map((u) => ({ url: u.url, w: u.w, h: u.h }));

    // Upsert via Prisma client. `hidden` heeft default false in DB.
    await prisma.product.upsert({
      where: { slug: bank.slug },
      create: {
        slug: bank.slug,
        name: bank.name,
        description: bank.description,
        price: 1499,
        category: bank.category,
        images: JSON.stringify(images),
        featured: false,
        stock: 5,
        deliveryTime: "4-6 weken",
        specs: JSON.stringify({
          Categorie: bank.category === "hoekbanken" ? "Hoekbank" : "Bank",
          Levertijd: "4-6 weken",
        }),
      },
      update: {
        name: bank.name,
        description: bank.description,
        category: bank.category,
        images: JSON.stringify(images),
      },
    });
    console.log(`    DB: ok`);
    console.log(`  klaar in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return { slug: bank.slug, ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`    FOUT: ${msg}`);
    return { slug: bank.slug, ok: false, error: msg };
  }
}

async function main() {
  if (!process.env.CLOUDINARY_API_KEY) {
    console.error("Cloudinary credentials ontbreken in .env.local");
    process.exit(1);
  }

  console.log("Scan wetransfer mappen...");
  const allBanks: BankToImport[] = [];
  allBanks.push(...await processSubfolderStyle(FOLDERS.hoek));
  allBanks.push(...await processSubfolderStyle(FOLDERS.finn));
  allBanks.push(...await processFlatStyle(FOLDERS.flat));

  // Dedupe op slug (eerste wint)
  const seen = new Set<string>();
  const unique = allBanks.filter((b) => {
    if (seen.has(b.slug)) return false;
    seen.add(b.slug);
    return true;
  });

  console.log(`\n${unique.length} unieke banken gevonden:`);
  for (const b of unique) {
    console.log(`  [${b.category}] ${b.name} (${b.pngPaths.length} foto's, src: ${b.source})`);
  }

  console.log(`\nStart import...`);
  const results: Array<{ slug: string; ok: boolean; error?: string }> = [];
  for (const b of unique) results.push(await processOne(b));

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${ok}/${results.length} ok ===`);
  if (failed.length) {
    for (const r of failed) console.log(`  ${r.slug}: ${r.error}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
