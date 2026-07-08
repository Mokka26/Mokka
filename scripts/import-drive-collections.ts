// Importeer ALLE drive-download collecties: slaapkamer-foto's → slaapkamers,
// overige (bank/tafel/tv/onbekend) → bankstellen. Alle foto's; klant snoeit zelf.
//
// - Bestaande producten: foto's VERVANGEN door volledige zip-bucket.
// - Verborgen slaapkamers (sk-*): zichtbaar maken.
// - Ontbrekende bankstellen (ürgüp/voyance/zelve): NIEUW, verborgen, €0.
// - ROLEX: overgeslagen (AI-renders, geen echte productfoto's).
//
// Dry-run: npx tsx scripts/import-drive-collections.ts
// Apply:   npx tsx scripts/import-drive-collections.ts --apply
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
const SRC = "C:/Users/konia/skimport2";

const IS_IMG = /\.(jpe?g|png|webp)$/i;
// Slaapkamer-signalen in bestandsnaam (Turks): bed, base, chest, wardrobe,
// nightstand, dressing table.
const IS_BEDROOM = /yatak|baza|şifonyer|sifonyer|gardolap|gardır|gardrop|komodin|makyaj/i;

function listImages(folder: string): string[] {
  const dir = `${SRC}/${folder}`;
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => IS_IMG.test(f))
    .map((f) => `${dir}/${f}`)
    .sort((a, b) => a.localeCompare(b));
}

type Mode = "split" | "allbed" | "allbank";
type Coll = {
  folder: string; mode: Mode;
  bed?: string; bank?: string;
  bankExtra?: string[]; newBankName?: string;
};
const COLLECTIONS: Coll[] = [
  { folder: "EFES",      mode: "split",   bed: "sk-efes",    bank: "efes-bankstel" },
  { folder: "GÖKÇE",     mode: "split",   bed: "sk-gokce",   bank: "gokce-bankstel" },
  { folder: "NİRVANA",   mode: "split",   bed: "sk-nirvana", bank: "nirvana-bankstel", bankExtra: ["NİRVANA 2"] },
  { folder: "ÜRGÜP",     mode: "split",   bed: "sk-urgup",   bank: "urgup-bankstel", newBankName: "Ürgüp Bankstel" },
  { folder: "KAPADOKYA", mode: "allbed",  bed: "kapadokyac-slaapkamer" },
  { folder: "HİSAR",     mode: "allbed",  bed: "hisar-bankstel" },
  { folder: "LİON",      mode: "allbank", bank: "lion-bankstel" },
  { folder: "LUCAS",     mode: "allbank", bank: "lucas-bankstel" },
  { folder: "PARİS",     mode: "allbank", bank: "paris-bankstel" },
  { folder: "TOKYO",     mode: "allbank", bank: "tokyo-bankstel" },
  { folder: "URLA",      mode: "allbank", bank: "urla-bankstel" },
  { folder: "VOYANCE",   mode: "allbank", bank: "voyance-bankstel", bankExtra: ["VOYANCE 2"], newBankName: "Voyance Bankstel" },
  { folder: "ZELVE",     mode: "allbank", bank: "zelve-bankstel", newBankName: "Zelve Bankstel" },
];

type Target = {
  slug: string; cat: "bankstellen" | "slaapkamers"; files: string[];
  isNew: boolean; name?: string; makeVisible: boolean;
};

function buildTargets(): Target[] {
  const t: Target[] = [];
  for (const c of COLLECTIONS) {
    const all = listImages(c.folder);
    const extra = (c.bankExtra ?? []).flatMap(listImages);
    let bedFiles: string[] = [], bankFiles: string[] = [];
    if (c.mode === "split") {
      bedFiles = all.filter((f) => IS_BEDROOM.test(f));
      bankFiles = all.filter((f) => !IS_BEDROOM.test(f)).concat(extra);
    } else if (c.mode === "allbed") {
      bedFiles = all.concat(extra);
    } else {
      bankFiles = all.concat(extra);
    }
    if (c.bed && bedFiles.length) {
      // Alle slaapkamer-doelen bestaan al → zichtbaar maken.
      t.push({ slug: c.bed, cat: "slaapkamers", files: bedFiles, isNew: false, makeVisible: true });
    }
    // Bestaande bankstellen bewust met rust laten — alleen NIEUWE bankstellen
    // (ürgüp/voyance/zelve) aanmaken.
    if (c.bank && bankFiles.length && c.newBankName) {
      t.push({ slug: c.bank, cat: "bankstellen", files: bankFiles, isNew: true, name: c.newBankName, makeVisible: false });
    }
  }
  return t;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const targets = buildTargets();
  console.log(`\n═══ Drive-collecties import — ${targets.length} producten ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  if (!APPLY) {
    let tot = 0;
    for (const t of targets) {
      tot += t.files.length;
      const tag = t.isNew ? "NIEUW (verborgen €0)" : t.cat === "slaapkamers" ? "zichtbaar maken" : "foto's vervangen";
      console.log(`  ${String(t.files.length).padStart(3)}f  [${t.cat}] ${t.slug.padEnd(22)} → ${tag}`);
    }
    console.log(`\nTotaal ${tot} foto-uploads. Run met --apply.`);
    await prisma.$disconnect();
    process.exit(0);
  }

  for (const t of targets) {
    process.stdout.write(`📦 ${t.slug.padEnd(22)} `);
    const imgs: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < t.files.length; i++) {
      try {
        const r = await cloudinary.uploader.upload(t.files[i], {
          public_id: `mokka/${t.cat}/${t.slug}/${String(i + 1).padStart(2, "0")}`,
          overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
        });
        imgs.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch (e) {
        process.stdout.write("x");
        if (i < 2) console.error(`\n   ✗ ${t.files[i]}: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(50);
    }
    if (!imgs.length) { process.stdout.write(" (0 — skip)\n"); continue; }

    if (t.isNew) {
      const name = t.name!;
      await prisma.product.upsert({
        where: { slug: t.slug },
        update: { images: JSON.stringify(imgs) },
        create: {
          slug: t.slug, name,
          description: `Complete ${name.replace(" Bankstel", "")} zitgroep. Samenstelling, maten en prijs op aanvraag.`,
          price: 0, category: "bankstellen", images: JSON.stringify(imgs),
          specs: JSON.stringify({ Categorie: "Bankstel", Type: "Zitgroep" }),
          source: "MUMZA", hidden: true, stock: 10,
        },
      });
    } else {
      await prisma.product.update({
        where: { slug: t.slug },
        data: { images: JSON.stringify(imgs), ...(t.makeVisible ? { hidden: false } : {}) },
      });
    }
    process.stdout.write(` (${imgs.length}${t.makeVisible ? ", zichtbaar" : ""}${t.isNew ? ", nieuw/verborgen" : ""})\n`);
  }
  console.log(`\n✅ Klaar.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
