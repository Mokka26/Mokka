// Volledige audit: 3 wetransfer-mappen ↔ DB
//   - Welke folders bestaan in welke wetransfer-dir?
//   - Welk product matcht elke folder?
//   - Hoeveel foto's per product?
//   - Zijn er folders zonder match? Producten zonder folder?
//   - Duplicaten (vergelijkbare namen / hidden vs visible)?
//
// Run:
//   npx tsx scripts/audit-folders-vs-db.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";
import { promises as fs } from "node:fs";
import path from "node:path";

const PUBLIC = path.join(process.cwd(), "public");
const WETRANSFERS = [
  "wetransfer_banken_2026-05-05_2016",
  "wetransfer_finn_2026-05-05_2021",
  "wetransfer_hoekbank-arte-inari-kongo-cc_2026-05-05_2026",
];

const KEEP_EXT = /\.(png|jpe?g|webp)$/i;
const SKIP_PATTERN = /specificat|size\s?edit|banner|preview|allinhouse|charm|watermerk|_maten|kopie|edit\.png$/i;

type FolderInfo = {
  wetransfer: string;
  folderName: string;
  folderPath: string;
  totalFiles: number;
  copilotCount: number;
  productPhotos: number;
  skipFiles: number;
};

async function walkForBanks(dir: string, wetransfer: string, out: FolderInfo[], depth = 0): Promise<void> {
  if (depth > 4) return;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  // Check of dit een product-folder is (geen subfolders met productfoto's)
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const images = files.filter((f) => KEEP_EXT.test(f));
  if (images.length > 0) {
    // Is dit een echte product-folder (niet "Bedden" container of weirdo)?
    const base = path.basename(dir).toLowerCase();
    // Skip wetransfer root + meta-folders
    if (!["bedden"].includes(base) && dir !== path.join(PUBLIC, wetransfer)) {
      const copilots = files.filter((f) => /^copilot_/i.test(f));
      const skipped = files.filter((f) => KEEP_EXT.test(f) && SKIP_PATTERN.test(f));
      const product = files.filter((f) => KEEP_EXT.test(f) && !SKIP_PATTERN.test(f) && !/^copilot_/i.test(f));
      out.push({
        wetransfer,
        folderName: path.basename(dir),
        folderPath: dir.replace(PUBLIC + path.sep, ""),
        totalFiles: images.length,
        copilotCount: copilots.length,
        productPhotos: product.length,
        skipFiles: skipped.length,
      });
    }
  }

  for (const e of entries) {
    if (e.isDirectory()) await walkForBanks(path.join(dir, e.name), wetransfer, out, depth + 1);
  }
}

// Heuristische match: folder-tokens → slug-tokens overlap
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !["cc", "c", "de", "het", "een"].includes(t));
}

type Product = { id: string; slug: string; name: string; category: string; images: string; hidden: boolean; deletedAt: Date | null };

function matchProductToFolder(folder: FolderInfo, products: Product[]): Product | null {
  const folderTokens = new Set(tokenize(folder.folderName));
  const generic = new Set(["bank", "hoekbank", "loungebank", "ubank"]);
  // Category hint
  let cat: string | null = null;
  if (/^hoekbank\b/i.test(folder.folderName)) cat = "hoekbanken";
  else if (/^(loungebank|u-?bank)\b/i.test(folder.folderName)) cat = "banken";
  else if (/[\\/]banken[\\/]/i.test(folder.folderPath)) cat = "banken";

  const pool = cat ? products.filter((p) => p.category === cat) : products;

  let best: { p: Product; score: number } | null = null;
  for (const p of pool) {
    const slugTok = new Set(tokenize(p.slug));
    let overlap = 0;
    for (const t of folderTokens) if (slugTok.has(t)) overlap++;
    if (overlap === 0) continue;
    let extras = 0;
    for (const t of slugTok) if (!folderTokens.has(t)) extras++;
    let extrasFolder = 0;
    for (const t of folderTokens) if (!slugTok.has(t)) extrasFolder++;
    const score = overlap - extras * 0.35 - extrasFolder * 0.1;
    if (!best || score > best.score) best = { p, score };
  }
  if (!best) return null;
  // Minstens 1 niet-generiek token overlap
  const folderSpec = [...folderTokens].filter((t) => !generic.has(t));
  const slugSpec = new Set(tokenize(best.p.slug).filter((t) => !generic.has(t)));
  if (folderSpec.filter((t) => slugSpec.has(t)).length < 1) return null;
  return best.p;
}

async function main() {
  console.log(`\n═══ Folders ↔ DB audit ═══\n`);

  // 1. Scan alle bank-folders
  const folders: FolderInfo[] = [];
  for (const wt of WETRANSFERS) {
    await walkForBanks(path.join(PUBLIC, wt), wt, folders);
  }
  console.log(`Folders gevonden: ${folders.length}\n`);

  // 2. Haal alle bank/hoekbank producten (incl hidden, incl deleted)
  const products: Product[] = await prisma.product.findMany({
    where: { category: { in: ["banken", "hoekbanken"] } },
    select: { id: true, slug: true, name: true, category: true, images: true, hidden: true, deletedAt: true },
  });

  // 3. Match per folder
  type Row = {
    folderName: string;
    wt: string;
    totalImg: number;
    matched?: Product;
    dbImageCount?: number;
    issues: string[];
  };

  const rows: Row[] = [];
  for (const f of folders) {
    const matched = matchProductToFolder(f, products) ?? undefined;
    const issues: string[] = [];
    let dbCount = 0;
    if (matched) {
      dbCount = parseImages(matched.images).length;
      if (matched.hidden) issues.push("HIDDEN");
      if (matched.deletedAt) issues.push("IN PRULLENBAK");
      if (dbCount === 0) issues.push("0 foto's in DB");
      if (dbCount < f.copilotCount + f.productPhotos) {
        issues.push(`folder=${f.copilotCount + f.productPhotos} files, DB=${dbCount}`);
      }
    } else {
      issues.push("GEEN MATCH");
    }
    rows.push({
      folderName: f.folderName,
      wt: f.wetransfer.split("_")[1] || f.wetransfer,
      totalImg: f.copilotCount + f.productPhotos,
      matched,
      dbImageCount: dbCount,
      issues,
    });
  }

  // ── Print: per wetransfer
  for (const wt of WETRANSFERS) {
    const key = wt.split("_")[1] || wt;
    const subset = rows.filter((r) => r.wt === key);
    console.log(`▼ ${wt}  (${subset.length} folders)`);
    console.log(`  ${"FOLDER".padEnd(45)} ${"PRODUCT (DB)".padEnd(40)} CAT          F/DB    issues`);
    console.log(`  ${"-".repeat(110)}`);
    for (const r of subset) {
      const product = r.matched
        ? `${r.matched.name} [${r.matched.slug}]`
        : "(geen match)";
      const cat = r.matched?.category ?? "-";
      const counts = `${r.totalImg}/${r.dbImageCount}`;
      const flag = r.issues.length > 0 ? "⚠ " + r.issues.join(", ") : "✓";
      console.log(`  ${r.folderName.padEnd(45)} ${product.padEnd(40)} ${cat.padEnd(12)} ${counts.padEnd(7)} ${flag}`);
    }
    console.log();
  }

  // 4. Producten in DB die GEEN folder hebben
  const matchedSlugs = new Set(rows.filter((r) => r.matched).map((r) => r.matched!.slug));
  const orphanProducts = products.filter((p) => !matchedSlugs.has(p.slug) && !p.deletedAt);
  console.log(`\n▼ Producten in DB zonder folder-match (${orphanProducts.length}):`);
  for (const p of orphanProducts) {
    const imgCount = parseImages(p.images).length;
    const flag = p.hidden ? "[HIDDEN]" : "";
    console.log(`  ${p.slug.padEnd(40)} cat=${p.category.padEnd(12)} foto's=${imgCount} ${p.name}  ${flag}`);
  }

  // 5. Duplicaten: zoek visible producten met vergelijkbare naam
  console.log(`\n▼ Mogelijke duplicaten:`);
  const visible = products.filter((p) => !p.deletedAt && !p.hidden);
  const seen = new Map<string, Product[]>();
  for (const p of visible) {
    // Normalize: strip type-woorden + -p\d+
    const key = p.slug
      .replace(/-bank$|-hoekbank$|-loungebank$|-u-bank$/, "")
      .replace(/-p\d+$/, "")
      .replace(/-(kemer|magic|monolith|kronos|riviera|soro|fresh|preston|croco|texarm|genova)\b/g, "");
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(p);
  }
  for (const [key, ps] of seen) {
    if (ps.length > 1) {
      console.log(`  "${key}" → ${ps.length}x:`);
      for (const p of ps) {
        const imgs = parseImages(p.images).length;
        console.log(`    · ${p.slug.padEnd(40)} cat=${p.category.padEnd(12)} foto's=${imgs}  "${p.name}"`);
      }
    }
  }

  // 6. Samenvatting
  const okCount = rows.filter((r) => r.matched && r.issues.length === 0).length;
  const issueCount = rows.filter((r) => r.issues.length > 0).length;
  console.log(`\n─── Samenvatting ───`);
  console.log(`  Folders → producten: ${rows.length}`);
  console.log(`  Schoon (0 issues): ${okCount}`);
  console.log(`  Met issues: ${issueCount}`);
  console.log(`  Producten zonder folder: ${orphanProducts.length}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
