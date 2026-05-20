// Cloudinary-only pipeline voor hoekbanken (geen OpenAI, geen lokale composite).
//
// Per slug:
//  1. Upload geselecteerde originelen uit photos-todo/<slug>/originals/
//     naar Cloudinary onder mokka/hoekbanken/<slug>-v2/source-N.png
//  2. Bouw transformation-URLs:
//      - Studio:    e_background_removal + drop-shadow + b_rgb:EDEDED + 1600x1600
//      - Lifestyle: e_background_removal + e_gen_background_replace (marble prompt)
//  3. Pre-warm HEAD-requests (Cloudinary genereert nu, eerste bezoek = instant)
//  4. Update DB: [studio-hero, lifestyle, studio-rest...]
//
// Run:
//   DATABASE_URL=$(grep "^DATABASE_URL" .env.local | cut -d= -f2-) \
//     npx tsx scripts/process-with-cloudinary.ts <slug> [flags]
//
// Flags:
//   --dry-run               geen upload + geen DB + geen pre-warm
//   --only=f1.png,f2.png    alleen deze files uploaden
//   --hero=<filename>       file die studio-1 + lifestyle-source wordt
//   --lifestyle=<filename>  expliciet kiezen welke file lifestyle-source wordt
//   --skip-upload           skip upload (bestanden al op Cloudinary), alleen URLs + DB
//   --skip-warm             skip pre-warm
//   --variant=A|B|C         studio-variant (A=met shadow, B=geen shadow, C=zwaarder)

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");
const SKIP_UPLOAD = args.includes("--skip-upload");
const SKIP_WARM = args.includes("--skip-warm");
const onlyList = args.find((a) => a.startsWith("--only="))?.split("=")[1]
  ?.split(",").map((s) => s.trim()).filter(Boolean);
const heroFile = args.find((a) => a.startsWith("--hero="))?.split("=")[1];
const lifestyleFile = args.find((a) => a.startsWith("--lifestyle="))?.split("=")[1];
const variant = (args.find((a) => a.startsWith("--variant="))?.split("=")[1] ?? "A") as "A" | "B" | "C";

if (!slug) {
  console.error("Usage: tsx scripts/process-with-cloudinary.ts <slug> [flags]");
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "diaksxzey";
// Studio bg: schoon wit zoals user reference "studeio afbeelding.png"
const STUDIO_BG = "FFFFFF";
// Output canvas: 4K 3:2 (matcht user reference aspect)
const OUT_W = 3840;
const OUT_H = 2560;
const CLD_FOLDER = `mokka/hoekbanken/${slug}-v2`;

const ROOT = process.cwd();
const originalsDir = path.join(ROOT, "photos-todo", slug, "originals");

// ─── Transformation chains (4K output, matcht user reference style) ───
const STUDIO_VARIANTS: Record<string, string[]> = {
  // A: schoon wit, geen shadow — matcht "studeio afbeelding.png" reference
  A: [
    "e_background_removal",
    `b_rgb:${STUDIO_BG}`,
    `c_pad,w_${OUT_W},h_${OUT_H},b_rgb:${STUDIO_BG}`,
    "q_auto:best,f_auto",
  ],
  // B: wit met subtiele drop-shadow voor extra diepte
  B: [
    "e_background_removal",
    "e_dropshadow:azimuth_215;elevation_45;spread_15",
    `b_rgb:${STUDIO_BG}`,
    `c_pad,w_${OUT_W},h_${OUT_H},b_rgb:${STUDIO_BG}`,
    "q_auto:best,f_auto",
  ],
  // C: licht grijs (#EDEDED) zoals eerdere prompt variant
  C: [
    "e_background_removal",
    "e_dropshadow:azimuth_215;elevation_45;spread_25",
    `b_rgb:EDEDED`,
    `c_pad,w_${OUT_W},h_${OUT_H},b_rgb:EDEDED`,
    "q_auto:best,f_auto",
  ],
};

// Lifestyle prompt: ultra-kort (Cloudinary URL-limit), matcht reference
const LIFESTYLE_TRANSFORMS: string[] = [
  "e_background_removal",
  "e_gen_background_replace:prompt_modern living room with oak floor beige walls marble table natural light",
  `c_pad,w_${OUT_W},h_${OUT_H}`,
  "q_auto:best,f_auto",
];

const encodePrompt = (t: string) =>
  t.replace(/prompt_([^/]+)/g, (_, p) => `prompt_${encodeURIComponent(p)}`);

const buildUrl = (publicId: string, transforms: string[]) =>
  `https://res.cloudinary.com/${CLOUD}/image/upload/${transforms.map(encodePrompt).join("/")}/${publicId}`;

async function uploadOriginal(localPath: string, publicId: string): Promise<string> {
  const result = await cloudinary.uploader.upload(localPath, {
    public_id: publicId.replace(`${CLD_FOLDER}/`, ""),
    folder: CLD_FOLDER,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
  });
  return result.public_id;
}

async function preWarm(url: string, label: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(120_000) });
    console.log(`  ${res.ok ? "✓" : "✗"}  [${res.status}] ${label}`);
    return res.ok;
  } catch (e) {
    console.log(`  ✗  [TIMEOUT] ${label}: ${(e as Error).message}`);
    return false;
  }
}

async function main() {
  console.log(`\n═══ Cloudinary-only pipeline: ${slug} ═══`);
  console.log(`  Cloudinary folder: ${CLD_FOLDER}`);
  console.log(`  Studio variant:    ${variant}`);
  console.log(`  Dry-run:           ${DRY_RUN}\n`);

  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) { console.error(`Product niet gevonden: ${slug}`); process.exit(1); }

  // Welke originelen?
  let originals: string[];
  try {
    originals = (await fs.readdir(originalsDir))
      .filter((f) => /\.(png|jpe?g)$/i.test(f))
      .filter((f) => !/specificat|size edit|allinhouse|charm|preview|banner/i.test(f))
      .sort();
  } catch {
    console.error(`Geen originals/ folder. Run eerst organize-hoekbank-originals.ts.`);
    process.exit(1);
  }

  if (onlyList && onlyList.length > 0) {
    const set = new Set(onlyList.map((f) => f.toLowerCase()));
    const missing = onlyList.filter((f) => !originals.some((o) => o.toLowerCase() === f.toLowerCase()));
    if (missing.length > 0) {
      console.error(`--only files niet gevonden:`); missing.forEach((m) => console.error(`  · ${m}`));
      process.exit(1);
    }
    originals = originals.filter((f) => set.has(f.toLowerCase()));
  }

  if (originals.length === 0) { console.error(`Geen originelen.`); process.exit(1); }

  // ─── Auto-detect: vooraanzicht = hero (matcht user studio reference), hoekaanzicht = lifestyle source ───
  // Skip files met "kopie" of "2" suffix (duplicates) tenzij er niets anders is
  const findBy = (re: RegExp): string | undefined => {
    const primary = originals.find((f) => re.test(f) && !/kopie|aanzicht2|vooraanzicht2/i.test(f));
    return primary ?? originals.find((f) => re.test(f));
  };

  const autoHero = heroFile ?? findBy(/vooraanzicht/i) ?? originals[0];
  const autoLifestyle = lifestyleFile ?? findBy(/hoekaanzicht/i) ?? findBy(/vooraanzicht/i) ?? originals[0];

  if (heroFile) {
    const idx = originals.findIndex((f) => f.toLowerCase() === heroFile.toLowerCase());
    if (idx === -1) { console.error(`--hero niet gevonden`); process.exit(1); }
    originals = [originals[idx], ...originals.slice(0, idx), ...originals.slice(idx + 1)];
  } else {
    // Auto: hero naar voren
    const idx = originals.findIndex((f) => f === autoHero);
    if (idx > 0) originals = [originals[idx], ...originals.slice(0, idx), ...originals.slice(idx + 1)];
  }
  const lifestyleSource = autoLifestyle;
  console.log(`Originelen (${originals.length}):`);
  originals.forEach((f, i) => console.log(`  source-${i + 1}.png  ←  ${f}${f === lifestyleSource ? "  ★ lifestyle" : ""}`));
  console.log();

  // ─── Stap 1: Upload originelen ───
  const studioVariant = STUDIO_VARIANTS[variant];
  const sourcePublicIds: Record<string, string> = {}; // origFilename → cloudinary publicId

  if (!SKIP_UPLOAD) {
    console.log(`─── Upload originelen naar Cloudinary ───`);
    for (const [i, file] of originals.entries()) {
      const localPath = path.join(originalsDir, file);
      const publicIdShort = `source-${i + 1}`;
      const fullPublicId = `${CLD_FOLDER}/${publicIdShort}`;
      if (DRY_RUN) {
        console.log(`  DRY  ${file}  →  ${fullPublicId}`);
        sourcePublicIds[file] = fullPublicId;
      } else {
        try {
          const pid = await uploadOriginal(localPath, publicIdShort);
          console.log(`  ✓  ${file}  →  ${pid}`);
          sourcePublicIds[file] = pid;
        } catch (e) {
          console.error(`  ✗  ${file}: ${(e as Error).message}`);
        }
      }
    }
  } else {
    // Skip upload — neem aan dat ze al op Cloudinary staan
    originals.forEach((f, i) => sourcePublicIds[f] = `${CLD_FOLDER}/source-${i + 1}`);
  }

  // ─── Stap 2: Bouw nieuwe DB images-array ───
  const newImages: string[] = [];
  // [0] hero studio
  newImages.push(buildUrl(sourcePublicIds[originals[0]], studioVariant));
  // [1] lifestyle
  newImages.push(buildUrl(sourcePublicIds[lifestyleSource], LIFESTYLE_TRANSFORMS));
  // [2..] rest studio
  originals.slice(1).forEach((f) => {
    newImages.push(buildUrl(sourcePublicIds[f], studioVariant));
  });

  console.log(`\n─── Nieuwe DB images-array ───`);
  newImages.forEach((url, i) => {
    const isLifestyle = i === 1;
    console.log(`  [${i}] ${isLifestyle ? "LIFESTYLE" : "studio   "}  ${url.slice(0, 120)}...`);
  });

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] Geen upload + geen DB-write + geen pre-warm.");
    return;
  }

  // ─── Stap 3: Pre-warm ───
  if (!SKIP_WARM) {
    console.log(`\n─── Pre-warm Cloudinary cache (eerst render kan 10-30s duren) ───`);
    for (const [i, url] of newImages.entries()) {
      await preWarm(url, `[${i}]`);
    }
  }

  // ─── Stap 4: Update DB ───
  await prisma.product.update({
    where: { slug },
    data: { images: JSON.stringify(newImages) },
  });
  console.log(`\n✓ DB bijgewerkt: ${slug} heeft nu ${newImages.length} Cloudinary-URLs.`);
  console.log(`✓ Bekijk: http://localhost:3000/products/${slug}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
