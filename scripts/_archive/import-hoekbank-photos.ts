/**
 * Importeer foto's uit photos-todo/<slug>/ naar public/ en update DB.
 *
 * Verwacht structuur:
 *   photos-todo/<slug>/
 *     studio/studio-1.jpg .. studio-N.jpg     (alle product-studio foto's)
 *     lifestyle/lifestyle-1.jpg               (1 woonkamer-foto)
 *
 * Volgorde in DB-array (na import):
 *   [0] studio-1     ← hero (1e foto op listing/PDP)
 *   [1] lifestyle-1  ← woonkamer
 *   [2] studio-2
 *   [3] studio-3
 *   ...
 *
 * Run:
 *   DATABASE_URL=$(grep "^DATABASE_URL" .env.local | cut -d= -f2-) \
 *     npx tsx scripts/import-hoekbank-photos.ts <slug>
 *
 * Flags:
 *   --dry-run   alleen rapporteren, geen kopie + geen DB-write
 *   --keep-old  hou bestaande images in DB; voeg nieuwe ervoor toe
 */

import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");
const KEEP_OLD = args.includes("--keep-old");

if (!slug) {
  console.error("Usage: tsx scripts/import-hoekbank-photos.ts <slug> [--dry-run] [--keep-old]");
  process.exit(1);
}

const ROOT = process.cwd();
const todoDir = path.join(ROOT, "photos-todo", slug);
const studioDir = path.join(todoDir, "studio");
const lifestyleDir = path.join(todoDir, "lifestyle");
const targetDir = path.join(ROOT, "public", "products", "hoekbanken", slug);
const publicUrlBase = `/products/hoekbanken/${slug}`;

async function listJpgs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => {
        // natural sort: studio-1 < studio-2 < ... < studio-10
        const na = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
        const nb = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
        return na - nb;
      });
  } catch {
    return [];
  }
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFile(src: string, dst: string) {
  await fs.copyFile(src, dst);
}

async function main() {
  console.log(`\n═══ Import foto's voor: ${slug} ═══`);
  console.log(`  Bron:   ${todoDir}`);
  console.log(`  Doel:   ${targetDir}`);
  console.log(`  Dry-run: ${DRY_RUN}`);
  console.log(`  Keep-old: ${KEEP_OLD}\n`);

  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) {
    console.error(`Product niet gevonden: ${slug}`);
    process.exit(1);
  }

  const studioFiles = await listJpgs(studioDir);
  const lifestyleFiles = await listJpgs(lifestyleDir);

  console.log("─── Gevonden bestanden ──────────────────────────────────");
  console.log(`  studio/:    ${studioFiles.length} foto's  ${studioFiles.join(", ")}`);
  console.log(`  lifestyle/: ${lifestyleFiles.length} foto's  ${lifestyleFiles.join(", ")}`);

  if (studioFiles.length === 0) {
    console.error(`\nGeen studio-foto's gevonden in ${studioDir}. Drop ze daar en run opnieuw.`);
    process.exit(1);
  }

  // ─── Bouw nieuwe images-array ───
  const newImages: string[] = [];
  // [0] hero = studio-1
  newImages.push(`${publicUrlBase}/${studioFiles[0]}`);
  // [1] lifestyle (als beschikbaar)
  for (const lf of lifestyleFiles) {
    newImages.push(`${publicUrlBase}/${lf}`);
  }
  // [2..] overige studio-foto's
  for (const sf of studioFiles.slice(1)) {
    newImages.push(`${publicUrlBase}/${sf}`);
  }

  console.log("\n─── Nieuwe DB images-array ──────────────────────────────");
  newImages.forEach((url, i) => {
    const isLifestyle = url.includes("/lifestyle");
    console.log(`  [${i}] ${isLifestyle ? "LIFESTYLE" : "studio   "}  ${url}`);
  });

  if (KEEP_OLD) {
    const existing: unknown[] = JSON.parse(product.images || "[]");
    const existingUrls = existing.map((e) =>
      typeof e === "string" ? e : (e as { url?: string }).url ?? ""
    ).filter(Boolean);
    newImages.push(...existingUrls);
    console.log(`\n[--keep-old] ${existingUrls.length} oude foto's toegevoegd achteraan`);
  }

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] Geen kopie + geen DB-write. Verwijder --dry-run om door te zetten.");
    return;
  }

  // ─── Kopieer bestanden naar public/ ───
  console.log("\n─── Kopiëren naar public/ ───────────────────────────────");
  await ensureDir(targetDir);
  for (const sf of studioFiles) {
    await copyFile(path.join(studioDir, sf), path.join(targetDir, sf));
    console.log(`  ✓  studio/${sf}`);
  }
  for (const lf of lifestyleFiles) {
    await copyFile(path.join(lifestyleDir, lf), path.join(targetDir, lf));
    console.log(`  ✓  lifestyle/${lf}`);
  }

  // ─── Update DB ───
  await prisma.product.update({
    where: { slug },
    data: { images: JSON.stringify(newImages) },
  });
  console.log(`\n✓ DB bijgewerkt: ${slug} heeft nu ${newImages.length} foto's.`);
  console.log(`✓ Bekijk: http://localhost:3000/products/${slug}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
