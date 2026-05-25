// Generieke folder-batch importer: elke subfolder onder --base → 1 product.
// Run: npx tsx scripts/import-folder-batch.ts --base="<dir>" --category=slaapkamers --type=Jeugdkamer --suffix=jeugdkamer [--apply]

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
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const APPLY = process.argv.includes("--apply");
const BASE = arg("base");
const CATEGORY = arg("category");
const TYPE = arg("type") ?? "Meubelstuk";
const SUFFIX = arg("suffix") ?? "";
const CAP = parseInt(arg("cap") ?? "12", 10);

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/ş/g, "s").replace(/ı/g, "i").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/i̇/g, "i")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function niceName(folder: string): string {
  return folder.replace(/^\d+\s*-\s*/, "").replace(/\d+/g, "").trim()
    .split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}
function collectImages(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(jpg|jpeg|png)$/i.test(e.name) && !/- kopya/i.test(e.name)) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

async function main() {
  if (!BASE || !CATEGORY) { console.error("--base= en --category= vereist"); process.exit(1); }
  const base = path.join(process.cwd(), BASE);
  if (!fs.existsSync(base)) { console.error(`map niet gevonden: ${base}`); process.exit(1); }
  const cols = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory());
  console.log(`\n═══ Folder-batch: ${cols.length} → [${CATEGORY}] ${TYPE} ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const plan = cols.map((c) => {
    const nm = niceName(c.name);
    return { folder: c.name, slug: slugify(c.name) + (SUFFIX ? `-${SUFFIX}` : ""), name: `${nm} ${TYPE}`, serie: nm, imgs: collectImages(path.join(base, c.name)) };
  }).filter((p) => p.imgs.length > 0);
  for (const p of plan) console.log(`  ${p.slug.padEnd(26)} ${p.imgs.length} foto's`);
  if (!APPLY) { console.log("\nDry-run."); process.exit(0); }

  for (const p of plan) {
    console.log(`\n📦 ${p.slug}`);
    const sel = p.imgs.slice(0, CAP);
    const images: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < sel.length; i++) {
      const pid = `mokka/${CATEGORY}/${p.slug}/${String(i + 1).padStart(2, "0")}`;
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
      description: `${TYPE} uit de ${p.serie}-collectie. Levertijd: 2-4 weken.`,
      price: 0, category: CATEGORY, images: JSON.stringify(images),
      specs: JSON.stringify({ Categorie: TYPE, Serie: p.serie, Levertijd: "2-4 weken" }),
      hidden: true, stock: 10,
    };
    const ex = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (ex) { await prisma.product.update({ where: { id: ex.id }, data }); console.log(` ✓ updated (${images.length})`); }
    else { await prisma.product.create({ data: { slug: p.slug, ...data } }); console.log(` ✓ created (${images.length})`); }
  }
  console.log(`\n✅ klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
