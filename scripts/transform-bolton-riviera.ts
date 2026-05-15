/**
 * Bake Cloudinary studio + lifestyle URLs voor Bolton Riviera hoekbank.
 *
 * Pipeline:
 *  - Voor elke originele foto (6x): genereer een studio-variant met
 *    background-removal, drop-shadow en warm bone (#EEEAE3) achtergrond.
 *  - Voor de eerste foto (hero): genereer extra een lifestyle-variant
 *    met AI generative wabi-sabi woonkamer scene.
 *  - HEAD-pre-warm elke URL zodat Cloudinary 'm vooraf genereert
 *    (eerste bezoek = instant, geen 5-15s wachttijd).
 *  - Update DB: images-array wordt [hero-studio, hero-lifestyle,
 *    detail1-studio, ..., detail5-studio].
 *
 * Run wanneer Cloudinary account weer actief is:
 *   DATABASE_URL=$(grep "^DATABASE_URL" .env.local | cut -d= -f2-) \
 *     npx tsx scripts/transform-bolton-riviera.ts
 *
 * Add --dry-run om alleen URLs te genereren zonder DB-write.
 * Add --variant=B|C|D om een andere studio-variant te kiezen (default A).
 * Add --lifestyle=F|G om een andere woonkamer-stijl te kiezen (default E).
 */

import { prisma } from "@/lib/prisma";

const CLOUD = "diaksxzey";
const SLUG = "bolton-riviera-hoekbank";
const BONE = "EEEAE3";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const variantArg = args.find((a) => a.startsWith("--variant="))?.split("=")[1] ?? "A";
const lifestyleArg = args.find((a) => a.startsWith("--lifestyle="))?.split("=")[1] ?? "E";

// ─── STUDIO VARIANTEN ──────────────────────────────────────────────────────
const STUDIO_VARIANTS: Record<string, string[]> = {
  A: [
    "e_background_removal",
    "e_dropshadow:azimuth_215;elevation_45;spread_25",
    `b_rgb:${BONE}`,
    "c_pad,w_1600,h_1600",
    "q_auto:best,f_auto",
  ],
  B: [
    "e_background_removal",
    `b_rgb:${BONE}`,
    "c_pad,w_1600,h_1600",
    "q_auto:best,f_auto",
  ],
  C: [
    "e_background_removal",
    "e_dropshadow:azimuth_180;elevation_60;spread_40",
    `b_rgb:${BONE}`,
    "c_pad,w_1600,h_1600",
    "q_auto:best,f_auto",
  ],
  D: [
    "e_background_removal",
    "e_dropshadow:azimuth_215;elevation_45;spread_25",
    `b_rgb:${BONE}`,
    "c_pad,w_2400,h_2400",
    "e_upscale",
    "q_auto:best,f_auto",
  ],
};

const LIFESTYLE_VARIANTS: Record<string, string[]> = {
  E: [
    "e_background_removal",
    "e_gen_background_replace:prompt_minimalist wabi-sabi living room with light oak wood floor warm linen curtains soft natural daylight neutral plaster walls",
    "c_pad,w_1600,h_1600",
    "q_auto:best,f_auto",
  ],
  F: [
    "e_background_removal",
    "e_gen_background_replace:prompt_editorial premium living room warm bone walls oak parquet floor terracotta accent wall soft natural light minimal styling",
    "c_pad,w_1600,h_1600",
    "q_auto:best,f_auto",
  ],
  G: [
    "e_background_removal",
    "e_gen_background_replace:prompt_modern loft living room large windows natural daylight concrete floor warm wood accents minimalist",
    "c_pad,w_1600,h_1600",
    "q_auto:best,f_auto",
  ],
};

const encodePrompt = (t: string) =>
  t.replace(/prompt_([^/]+)/g, (_, p) => `prompt_${encodeURIComponent(p)}`);

const buildUrl = (publicId: string, transforms: string[]) => {
  const t = transforms.map(encodePrompt).join("/");
  return `https://res.cloudinary.com/${CLOUD}/image/upload/${t}/${publicId}`;
};

// Image-entry kan string OF { url: "..." } object zijn — normaliseer naar string
const normalize = (entry: unknown): string => {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && "url" in entry) return String((entry as { url: unknown }).url ?? "");
  return "";
};

// publicId extract uit raw Cloudinary URL
const extractPublicId = (rawUrl: string): string | null => {
  // bv https://res.cloudinary.com/diaksxzey/image/upload/v1778626254/mokka/.../hero.png
  const m = rawUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  return m ? m[1] : null;
};

async function preWarm(url: string, label: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(120_000) });
    const ok = res.ok;
    const status = res.status;
    console.log(`  ${ok ? "✓" : "✗"}  [${status}] ${label}`);
    return { ok, status };
  } catch (e) {
    console.log(`  ✗  [TIMEOUT/ERR] ${label}: ${(e as Error).message}`);
    return { ok: false, status: 0 };
  }
}

async function main() {
  console.log(`\n═══ Bake Bolton Riviera ═══`);
  console.log(`  Studio variant:    ${variantArg}`);
  console.log(`  Lifestyle variant: ${lifestyleArg}`);
  console.log(`  Dry-run:           ${DRY_RUN}\n`);

  const studio = STUDIO_VARIANTS[variantArg];
  const lifestyle = LIFESTYLE_VARIANTS[lifestyleArg];
  if (!studio || !lifestyle) {
    console.error(`Onbekende variant. Studio: A|B|C|D, Lifestyle: E|F|G`);
    process.exit(1);
  }

  const product = await prisma.product.findUnique({ where: { slug: SLUG } });
  if (!product) {
    console.error(`Product niet gevonden: ${SLUG}`);
    process.exit(1);
  }

  const rawEntries: unknown[] = JSON.parse(product.images || "[]");
  const originalUrls: string[] = rawEntries.map(normalize).filter(Boolean);
  if (originalUrls.length === 0) {
    console.error(`Geen foto's gevonden op ${SLUG}`);
    process.exit(1);
  }

  console.log(`Originele foto's: ${originalUrls.length}\n`);

  // Genereer nieuwe URL-array
  const newImages: string[] = [];
  console.log("─── Genereren + pre-warm ───────────────────────────────");

  for (const [i, rawUrl] of originalUrls.entries()) {
    const publicId = extractPublicId(rawUrl);
    if (!publicId) {
      console.warn(`  Skip [${i}]: kan publicId niet extraheren uit ${rawUrl}`);
      newImages.push(rawUrl);
      continue;
    }

    const studioUrl = buildUrl(publicId, studio);
    if (!DRY_RUN) await preWarm(studioUrl, `[${i}] studio (${publicId.split("/").pop()})`);
    else console.log(`  · studio   [${i}] ${publicId}`);
    newImages.push(studioUrl);

    // Voor de hero (i=0): genereer ook een lifestyle-variant en zet die op pos 1
    if (i === 0) {
      const lifestyleUrl = buildUrl(publicId, lifestyle);
      if (!DRY_RUN) await preWarm(lifestyleUrl, `[0] lifestyle (${publicId.split("/").pop()})`);
      else console.log(`  · lifestyle [0] ${publicId}`);
      newImages.push(lifestyleUrl);
    }
  }

  console.log("\n─── Nieuwe images-array ────────────────────────────────");
  newImages.forEach((url, i) => {
    const isLifestyle = i === 1;
    console.log(`  [${i}] ${isLifestyle ? "LIFESTYLE" : "studio   "}  ${url.slice(0, 120)}...`);
  });

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] DB niet aangepast. Verwijder --dry-run om door te zetten.");
    return;
  }

  await prisma.product.update({
    where: { slug: SLUG },
    data: { images: JSON.stringify(newImages) },
  });
  console.log(`\n✓ DB bijgewerkt: ${SLUG} heeft nu ${newImages.length} foto's.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
