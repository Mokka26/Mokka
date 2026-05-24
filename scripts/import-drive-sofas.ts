// Batch-import drive-zip sofa-collecties. Elke top-level collectie-folder →
// één bankstel-product (bankstellen) met alle set-foto's (cap 12).
// User splitst bank/fauteuil/hoekbank + zet prijs via /admin.
//
// Run: npx tsx scripts/import-drive-sofas.ts --dir=_import-d1 [--apply]

import { config } from "dotenv";
config({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const DIR = process.argv.find((a) => a.startsWith("--dir="))?.split("=")[1];
const CAP = 12;

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/ş/g, "s").replace(/ı/g, "i").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/İ/g, "i")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
// Titlecase, strip "Koltuk Tk" noise
function niceName(folder: string): string {
  const base = folder.replace(/\d+/g, "").trim();
  return base.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// Vind alle jpg's recursief onder een collectie-folder
function collectImages(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(jpg|jpeg|png)$/i.test(e.name)) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

async function main() {
  if (!DIR) { console.error("--dir= vereist (bv _import-d1)"); process.exit(1); }
  const base = path.join(process.cwd(), DIR);
  if (!fs.existsSync(base)) { console.error(`map niet gevonden: ${base}`); process.exit(1); }

  const collections = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory());
  console.log(`\n═══ Drive sofa-import: ${DIR} (${collections.length} collecties) ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const plan = collections.map((c) => {
    const imgs = collectImages(path.join(base, c.name));
    return { folder: c.name, slug: slugify(c.name) + "-bankstel", name: niceName(c.name) + " Bankstel", imgs };
  });
  for (const p of plan) console.log(`  ${p.slug.padEnd(26)} ${p.imgs.length} foto's → cap ${CAP}`);

  if (!APPLY) { console.log("\nDry-run."); process.exit(0); }

  for (const p of plan) {
    if (!p.imgs.length) { console.log(`⏭ skip ${p.slug}`); continue; }
    console.log(`\n📦 ${p.slug}`);
    const sel = p.imgs.slice(0, CAP);
    const images: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < sel.length; i++) {
      const pid = `mokka/bankstellen/${p.slug}/${String(i + 1).padStart(2, "0")}`;
      try {
        const r = await cloudinary.uploader.upload(sel[i], {
          public_id: pid, overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
        });
        images.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch (e) { console.error(`\n  ✗ ${e instanceof Error ? e.message : e}`); }
    }
    const data = {
      name: p.name,
      description: `Bankstel uit de ${niceName(p.folder)}-collectie. Gestoffeerd zitcomfort. Levertijd: 2-4 weken.`,
      price: 0, category: "bankstellen", images: JSON.stringify(images),
      specs: JSON.stringify({ Categorie: "Bankstel", Serie: niceName(p.folder), Materiaal: "Stof", Levertijd: "2-4 weken" }),
      hidden: true, stock: 10,
    };
    const ex = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (ex) { await prisma.product.update({ where: { id: ex.id }, data }); console.log(` ✓ updated (${images.length})`); }
    else { await prisma.product.create({ data: { slug: p.slug, ...data } }); console.log(` ✓ created (${images.length})`); }
  }
  console.log(`\n✅ ${DIR} klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
