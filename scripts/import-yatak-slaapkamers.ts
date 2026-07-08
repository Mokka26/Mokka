// Slaapkamers uit "1 - Yatak ve Yemek" zip. Alleen de YATAK/BEDROOM-secties
// (uitgepakt in C:/Users/konia/skimport_yatak/<collectie>/). Bestaande slaapkamers
// worden VERVANGEN door de volledige officiële set; ontbrekende worden NIEUW
// aangemaakt (verborgen, €0). Foto's worden verkleind (bron is 10-30MB).
//
// Dry-run: npx tsx scripts/import-yatak-slaapkamers.ts
// Apply:   npx tsx scripts/import-yatak-slaapkamers.ts --apply
import { config as loadEnv } from "dotenv"; loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import { readdirSync, existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const SRC = "C:/Users/konia/skimport_yatak";
const TMP = `${SRC}/_resized`;
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });
const IS_IMG = /\.(jpe?g|png|webp)$/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function list(folder: string): string[] {
  const d = `${SRC}/${folder}`;
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((x) => IS_IMG.test(x)).sort((a, b) => a.localeCompare(b)).map((x) => `${d}/${x}`);
}

type Coll = { folder: string; slug: string; name: string; isNew?: boolean };
const COLLS: Coll[] = [
  { folder: "2025-GLORY",   slug: "gloryslaapkamer",       name: "Glory Slaapkamer" },
  { folder: "2025-NORA",    slug: "noraslaapkamer",        name: "Nora Slaapkamer" },
  { folder: "2026 - CREA",  slug: "creaslaapkamer",        name: "Crea Slaapkamer" },
  { folder: "2026 - MARVEN",slug: "marven-kaptafel",       name: "Marven Slaapkamer" },
  { folder: "2026 - SOPRANO",slug: "soprano-bed",          name: "Soprano Slaapkamer" },
  { folder: "2024 - ANDORA",slug: "andora-slaapkamer",     name: "Andora Slaapkamer", isNew: true },
  { folder: "2024 - CAPRIS",slug: "capris-slaapkamer",     name: "Capris Slaapkamer", isNew: true },
  { folder: "2025-ANGEL",   slug: "angel-slaapkamer",      name: "Angel Slaapkamer",  isNew: true },
];

async function uploadPrepped(file: string, publicId: string, idx: number) {
  const tmp = `${TMP}/${idx}.jpg`;
  try {
    await sharp(file, { failOn: "none" }).rotate().resize(3000, 3000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(tmp);
  } catch { return null; }
  for (let a = 1; a <= 4; a++) {
    try {
      const r = await cloudinary.uploader.upload(tmp, { public_id: publicId, overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto", timeout: 120000 });
      return { url: r.secure_url, w: r.width, h: r.height };
    } catch { await sleep(a * 600); }
  }
  return null;
}
async function dbWrite(fn: () => Promise<unknown>) {
  for (let a = 1; a <= 12; a++) { try { await fn(); return; } catch (e) { if (a === 12) throw e; await sleep(Math.min(a * 2500, 15000)); } }
}

async function main() {
  console.log(`\n═══ Yatak-slaapkamers — ${COLLS.length} producten ═══`);
  if (!APPLY) {
    let tot = 0;
    for (const c of COLLS) { const n = list(c.folder).length; tot += n; console.log(`  ${String(n).padStart(3)}f  ${c.slug.padEnd(20)} ${c.isNew ? "NIEUW (verborgen €0)" : "vervangen"}  (${c.folder})`); }
    console.log(`\nTotaal ${tot} foto's. Run met --apply.`);
    await prisma.$disconnect(); process.exit(0);
  }
  for (const c of COLLS) {
    const files = list(c.folder);
    process.stdout.write(`📦 ${c.slug.padEnd(20)} `);
    const imgs: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const r = await uploadPrepped(files[i], `mokka/slaapkamers/${c.slug}/${String(i + 1).padStart(2, "0")}`, i + 1);
      if (r) { imgs.push(r); process.stdout.write("."); } else process.stdout.write("X");
      await sleep(120);
    }
    if (!imgs.length) { process.stdout.write(" (0 — skip)\n"); continue; }
    if (c.isNew) {
      await dbWrite(() => prisma.product.upsert({
        where: { slug: c.slug }, update: { images: JSON.stringify(imgs) },
        create: { slug: c.slug, name: c.name, description: `Complete ${c.name.replace(" Slaapkamer", "")} slaapkamer. Samenstelling, maten en prijs op aanvraag.`,
          price: 0, category: "slaapkamers", images: JSON.stringify(imgs), specs: JSON.stringify({ Categorie: "Slaapkamer", Type: "Complete set" }), source: "NIVE", hidden: true, stock: 10 },
      }));
    } else {
      await dbWrite(() => prisma.product.update({ where: { slug: c.slug }, data: { images: JSON.stringify(imgs) } }));
    }
    process.stdout.write(` (${imgs.length}/${files.length}${c.isNew ? ", nieuw/verborgen" : ", vervangen"})\n`);
  }
  console.log(`\n✅ Klaar.`);
  await prisma.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
