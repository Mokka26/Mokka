// Import One World (1 Dünya) sleep-sets als bedden. Foto's van de website
// (schoon, geen watermerk). Verborgen + €0 (geen prijzen bekend → user vult later).
// Specs uit de Oneworld-PDF kunnen later verrijkt worden (zie geheugen).
//
// Dry-run: npx tsx scripts/import-oneworld-beds.ts
// Apply:   npx tsx scripts/import-oneworld-beds.ts --apply
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BASE = "https://1dunya.com.tr/en/product";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const SLUGS = [
  "bumby","rodos","mykonos","faber","sleep-balance","athena","puzzle","florida",
  "1-sleep","mathilda","moonlight","julie","cancun","arte","odessa","cotton",
  "panama","chloe","diana","queen","vesta","bella","pianno","picasso","wawe",
  "verona","dimmax","fallone","madrid","parma","hermes","silver","paros","como",
  "best","caria","monza","costa","siesta","loft",
];

const titel = (s: string) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

async function fetchImages(slug: string): Promise<string[]> {
  const res = await fetch(`${BASE}/${slug}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const set = new Set<string>();
  const re = /https:\/\/1dunya\.com\.tr\/uploads\/products\/(?:gallery\/)?[^\s"'<>]+?\.(?:jpe?g|png|webp)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[0]);
  // hoofdfoto (_main_) eerst, dan galerij
  return [...set].sort((a, b) => (a.includes("_main_") ? -1 : 0) - (b.includes("_main_") ? -1 : 0));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n═══ One World bedden — ${SLUGS.length} producten ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  // FASE 1 — fetch + (apply) upload
  const built: { slug: string; name: string; uploaded: { url: string; w: number; h: number }[] }[] = [];
  for (const slug of SLUGS) {
    const dbSlug = `ow-${slug}`;
    const name = `${titel(slug)} Boxspring`;
    let imgs: string[] = [];
    try { imgs = await fetchImages(slug); }
    catch (e) { console.log(`✗ ${slug}: ${e instanceof Error ? e.message : e}`); }
    if (!APPLY) {
      console.log(`  ${imgs.length ? "✓" : "⚠"} ${dbSlug.padEnd(20)} ${String(imgs.length).padStart(2)} foto's  (${name})`);
      await sleep(120); continue;
    }
    process.stdout.write(`📦 ${dbSlug} `);
    const uploaded: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < imgs.length; i++) {
      try {
        const r = await cloudinary.uploader.upload(imgs[i], {
          public_id: `mokka/bedden/${dbSlug}/${String(i + 1).padStart(2, "0")}`,
          overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
        });
        uploaded.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch { process.stdout.write("x"); }
    }
    built.push({ slug: dbSlug, name, uploaded });
    process.stdout.write(` (${uploaded.length})\n`);
    await sleep(120);
  }

  if (!APPLY) { console.log("\nDry-run klaar."); await prisma.$disconnect(); process.exit(0); }

  // FASE 2 — DB
  console.log("\n─── DB ───");
  for (const b of built) {
    if (!b.uploaded.length) { console.log(`⏭ skip ${b.slug} (geen foto's)`); continue; }
    const specs = { Categorie: "Boxspring", Serie: b.name.replace(" Boxspring", ""), Type: "Slaapset" };
    const data = {
      name: b.name,
      description: `Boxspring uit de One World-collectie. Comfortabele slaapset met gestoffeerd hoofdbord en opbergruimte. Levertijd: 2-4 weken.`,
      price: 0, category: "bedden",
      images: JSON.stringify(b.uploaded), specs: JSON.stringify(specs),
      source: "One World", hidden: true, stock: 10,
    };
    await prisma.product.upsert({ where: { slug: b.slug }, update: data, create: { slug: b.slug, ...data } });
    console.log(`  ✓ ${b.slug} (${b.uploaded.length})`);
  }
  console.log(`\n✅ One World bedden klaar — verborgen, €0, source 'One World'.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
