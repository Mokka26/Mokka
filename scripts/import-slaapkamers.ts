// Import complete slaapkamers (Turkse collectie uit Google Drive).
// Alleen de slaapkamer-foto's; banken/eetkamers uit gemengde modellen worden
// gefilterd. Verborgen + €0 (prijzen volgen later van de klant).
//
// Foto's staan uitgepakt in scratchpad/sk/<MODEL>/.
//
// Dry-run: npx tsx scripts/import-slaapkamers.ts
// Apply:   npx tsx scripts/import-slaapkamers.ts --apply
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import { readdirSync, existsSync } from "node:fs";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
// Stabiele map buiten temp/OneDrive — de sessie-scratchpad wordt automatisch
// leeggeruimd tijdens de upload.
const SRC = "C:/Users/konia/skimport";

// mixed = alleen slaapkamer-bestanden nemen; pure = alle foto's.
type Model = { folder: string; slug: string; name: string; mixed: boolean };
// Alleen modellen met "Yatak Odası"-gelabelde bestanden → gegarandeerd alleen
// slaapkamer-foto's (mixed=true filtert op die labels).
// Bewust NIET hier:
//  - KAPADOKYA / HİSAR: bestaan al als zichtbare, geprijsde slaapkamers.
//  - LİON / ROLEX: volledige collecties met generieke bestandsnamen (bed +
//    bank + eetkamer door elkaar, incl. AI-renders) → niet betrouwbaar te
//    filteren; vergen handmatige selectie.
const MODELS: Model[] = [
  { folder: "NİRVANA",   slug: "sk-nirvana",   name: "Nirvana",   mixed: true },
  { folder: "EFES",      slug: "sk-efes",      name: "Efes",      mixed: true },
  { folder: "GÖKÇE",     slug: "sk-gokce",     name: "Gökçe",     mixed: true },
  { folder: "ÜRGÜP",     slug: "sk-urgup",     name: "Ürgüp",     mixed: true },
];

const IS_IMG = /\.(jpe?g|png)$/i;
const IS_BEDROOM = /yatak|baza|şifonyer|sifonyer|gardolap|gard[iı]r|komodin/i;

function selectFiles(m: Model): string[] {
  const dir = `${SRC}/${m.folder}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => IS_IMG.test(f) && (m.mixed ? IS_BEDROOM.test(f) : true))
    .sort((a, b) => a.localeCompare(b));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n═══ Slaapkamers — ${MODELS.length} modellen ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  const built: { m: Model; imgs: { url: string; w: number; h: number }[] }[] = [];
  for (const m of MODELS) {
    const files = selectFiles(m);
    if (!APPLY) {
      console.log(`  ${files.length ? "✓" : "⚠"} ${m.slug.padEnd(14)} ${String(files.length).padStart(2)} foto's  (${m.folder}${m.mixed ? ", gefilterd" : ""})`);
      continue;
    }
    process.stdout.write(`📦 ${m.slug} `);
    const uploaded: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const r = await cloudinary.uploader.upload(`${SRC}/${m.folder}/${files[i]}`, {
          public_id: `mokka/slaapkamers/${m.slug}/${String(i + 1).padStart(2, "0")}`,
          overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
        });
        uploaded.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch (e) {
        process.stdout.write("x");
        if (uploaded.length === 0 && i < 2) console.error(`\n   ✗ ${files[i]}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
      }
      await sleep(60);
    }
    built.push({ m, imgs: uploaded });
    process.stdout.write(` (${uploaded.length})\n`);
  }

  if (!APPLY) {
    console.log(`\nTotaal: ${MODELS.reduce((s, m) => s + selectFiles(m).length, 0)} foto's. Run met --apply.`);
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log("\n─── DB ───");
  for (const { m, imgs } of built) {
    if (!imgs.length) { console.log(`⏭ skip ${m.slug} (geen foto's)`); continue; }
    const specs = { Categorie: "Slaapkamer", Type: "Complete set" };
    const data = {
      name: `${m.name} Slaapkamer`,
      description: `Complete slaapkamer uit de ${m.name}-collectie — set met bed en bijpassende kasten. Samenstelling, maten en prijs op aanvraag.`,
      price: 0,
      category: "slaapkamers",
      images: JSON.stringify(imgs),
      specs: JSON.stringify(specs),
      source: "Slaapkamers",
      hidden: true,
      stock: 10,
    };
    await prisma.product.upsert({ where: { slug: m.slug }, update: data, create: { slug: m.slug, ...data } });
    console.log(`  ✓ ${m.slug} (${imgs.length} foto's)`);
  }
  console.log(`\n✅ Slaapkamers klaar — verborgen, €0, categorie 'slaapkamers'. Prijzen volgen later.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
