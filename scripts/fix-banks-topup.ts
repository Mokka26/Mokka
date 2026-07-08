// Herstel na de dubbele-run: (A) 5 beschadigde banken terug naar alleen
// sofa-foto's; (B) de 9 import-doelen volledig bijvullen. Idempotent (overwrite).
//
// Apply: npx tsx scripts/fix-banks-topup.ts --apply
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
const IS_BEDROOM = /yatak|baza|şifonyer|sifonyer|gardolap|gardır|gardrop|komodin|makyaj/i;
const IS_KOLTUK = /koltuk/i;
const base = (p: string) => p.split(/[\\/]/).pop()!;

function list(folder: string): string[] {
  const d = `${SRC}/${folder}`;
  if (!existsSync(d)) return [];
  return (readdirSync(d, { recursive: true }) as string[])
    .filter((x) => IS_IMG.test(x))
    .map((x) => `${d}/${x}`.replace(/\\/g, "/"))
    .sort((a, b) => a.localeCompare(b));
}

// LİON heeft geen koltuk-labels → handmatig gekozen sofa-shots.
const LION_SOFA = new Set([
  "LİON (3).JPG", "LİON (6).JPG", "LİON (7).JPG", "LİON (8).JPG",
  "LİON (14).jpg", "LİON (15).jpg", "LİON (29).JPG",
]);

type Target = {
  slug: string; cat: "bankstellen" | "slaapkamers"; files: string[];
  visible?: boolean; isNew?: boolean; name?: string;
};

function buildTargets(): Target[] {
  const bedroom = (f: string) => list(f).filter((x) => IS_BEDROOM.test(x));
  const nonBed = (f: string) => list(f).filter((x) => !IS_BEDROOM.test(x));
  return [
    // ── A: sofa-only trim (bestaande banken) ──
    { slug: "efes-bankstel",    cat: "bankstellen", files: list("EFES").filter((x) => IS_KOLTUK.test(x)) },
    { slug: "gokce-bankstel",   cat: "bankstellen", files: list("GÖKÇE").filter((x) => IS_KOLTUK.test(x)) },
    { slug: "nirvana-bankstel", cat: "bankstellen", files: list("NİRVANA").filter((x) => IS_KOLTUK.test(x)) },
    { slug: "lucas-bankstel",   cat: "bankstellen", files: list("LUCAS").filter((x) => IS_KOLTUK.test(x)) },
    { slug: "lion-bankstel",    cat: "bankstellen", files: list("LİON").filter((x) => LION_SOFA.has(base(x))) },
    // ── B: bijvullen (volledige buckets) ──
    { slug: "sk-efes",    cat: "slaapkamers", files: bedroom("EFES"),    visible: true },
    { slug: "sk-gokce",   cat: "slaapkamers", files: bedroom("GÖKÇE"),   visible: true },
    { slug: "sk-nirvana", cat: "slaapkamers", files: bedroom("NİRVANA"), visible: true },
    { slug: "sk-urgup",   cat: "slaapkamers", files: bedroom("ÜRGÜP"),   visible: true },
    { slug: "kapadokyac-slaapkamer", cat: "slaapkamers", files: list("KAPADOKYA"), visible: true },
    { slug: "hisar-bankstel",        cat: "slaapkamers", files: list("HİSAR"),     visible: true },
    { slug: "urgup-bankstel",   cat: "bankstellen", files: nonBed("ÜRGÜP"), isNew: true, name: "Ürgüp Bankstel" },
    { slug: "voyance-bankstel", cat: "bankstellen", files: [...list("VOYANCE"), ...list("VOYANCE 2")], isNew: true, name: "Voyance Bankstel" },
    { slug: "zelve-bankstel",   cat: "bankstellen", files: list("ZELVE"), isNew: true, name: "Zelve Bankstel" },
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const targets = buildTargets();
  console.log(`\n═══ Herstel + bijvullen — ${targets.length} producten ═══`);
  if (!APPLY) {
    targets.forEach((t) => console.log(`  ${String(t.files.length).padStart(3)}f  [${t.cat}] ${t.slug}${t.isNew ? " (nieuw)" : t.visible ? " (zichtbaar)" : " (sofa-trim)"}`));
    console.log(`\nTotaal ${targets.reduce((s, t) => s + t.files.length, 0)} uploads. Run met --apply.`);
    await prisma.$disconnect(); process.exit(0);
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
      await prisma.product.upsert({
        where: { slug: t.slug },
        update: { images: JSON.stringify(imgs) },
        create: {
          slug: t.slug, name: t.name!,
          description: `Complete ${t.name!.replace(" Bankstel", "")} zitgroep. Samenstelling, maten en prijs op aanvraag.`,
          price: 0, category: "bankstellen", images: JSON.stringify(imgs),
          specs: JSON.stringify({ Categorie: "Bankstel", Type: "Zitgroep" }),
          source: "MUMZA", hidden: true, stock: 10,
        },
      });
    } else {
      await prisma.product.update({
        where: { slug: t.slug },
        data: { images: JSON.stringify(imgs), ...(t.visible ? { hidden: false } : {}) },
      });
    }
    process.stdout.write(` (${imgs.length})\n`);
  }
  console.log(`\n✅ Klaar.`);
  await prisma.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
