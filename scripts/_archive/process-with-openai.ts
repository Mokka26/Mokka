// Pixel-perfect product foto's: composite-pipeline (geen regeneratie van bank).
//
// Pipeline:
//   1. Lokale background removal (@imgly/background-removal-node) → bank cutout (PNG met alpha)
//   2. STUDIO: genereer grijze gradient achtergrond LOKAAL met sharp, composite bank erop
//   3. LIFESTYLE: genereer marmer-scene via OpenAI text-to-image, composite bank erop
//   → Bank pixels NOOIT aangeraakt door AI. 100% identiek aan origineel.
//
// Vereist OPENAI_API_KEY in .env.local (alleen voor lifestyle achtergrond-generatie).
//
// Run:
//   OPENAI_API_KEY=$(grep "^OPENAI_API_KEY" .env.local | cut -d= -f2-) \
//     npx tsx scripts/process-with-openai.ts <slug> [flags]
//
// Flags:
//   --dry-run               rapport zonder API-calls of file writes
//   --quality=high          low|medium|high (alleen voor lifestyle bg via OpenAI)
//   --size=1024x1024        canvas + OpenAI bg size
//   --skip-lifestyle        alleen studio (geen OpenAI calls nodig)
//   --hero=<filename>       file die studio-1 + lifestyle-source wordt
//   --lifestyle=<filename>  expliciet kiezen welke file lifestyle wordt
//   --only=f1.png,f2.png    alleen deze files verwerken

import { promises as fs } from "node:fs";
import path from "node:path";
import { removeBackground } from "@imgly/background-removal-node";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import sharp from "sharp";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");
const SKIP_LIFESTYLE = args.includes("--skip-lifestyle");
const quality = (args.find((a) => a.startsWith("--quality="))?.split("=")[1] ?? "high") as
  "low" | "medium" | "high";
const sizeStr = args.find((a) => a.startsWith("--size="))?.split("=")[1] ?? "1024x1024";
const heroFile = args.find((a) => a.startsWith("--hero="))?.split("=")[1];
const lifestyleFile = args.find((a) => a.startsWith("--lifestyle="))?.split("=")[1];
const onlyList = args.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",").map((s) => s.trim()).filter(Boolean);

if (!slug) {
  console.error("Usage: tsx scripts/process-with-openai.ts <slug> [flags]");
  process.exit(1);
}
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY && !DRY_RUN && !SKIP_LIFESTYLE) {
  console.error("OPENAI_API_KEY niet gevonden in .env.local (nodig voor lifestyle background-generation).");
  process.exit(1);
}

const [canvasW, canvasH] = sizeStr.split("x").map((n) => parseInt(n, 10));
const ROOT = process.cwd();
const todoDir = path.join(ROOT, "photos-todo", slug);
const originalsDir = path.join(todoDir, "originals");
const studioDir = path.join(todoDir, "studio");
const lifestyleDir = path.join(todoDir, "lifestyle");
const cutoutDir = path.join(todoDir, ".cutouts");

// ─── OpenAI text-to-image (alleen voor lifestyle achtergrond) ───
const LIFESTYLE_BG_PROMPT =
  "Empty luxury interior scene: polished white marble surface in foreground with subtle grey veining, " +
  "warm soft lighting from the side casting elegant shadows, shallow depth of field, " +
  "neutral cream-colored wall in soft focus background, premium aesthetic, cinematic, 4k. " +
  "No furniture, no people, no products — just the empty marble surface and warm ambient lighting.";

async function generateBackground(prompt: string, w: number, h: number): Promise<Buffer> {
  // gpt-image-1 accepteert alleen specifieke maten
  const apiSize = w === h ? "1024x1024" : w > h ? "1536x1024" : "1024x1536";
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", apiSize);
  form.append("quality", quality);
  form.append("output_format", "png");
  form.append("n", "1");

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1", prompt, size: apiSize, quality, output_format: "png", n: 1,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI bg ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = await res.json() as { data: { b64_json: string }[] };
  return Buffer.from(json.data[0].b64_json, "base64");
}

// ─── Background removal → bank cutout (PNG met alpha) ───
async function makeCutout(imagePath: string, outPath: string): Promise<void> {
  const imageBuf = await fs.readFile(imagePath);
  const blob = new Blob([imageBuf], { type: "image/png" });
  const cutoutBlob = await removeBackground(blob);
  const cutoutBuf = Buffer.from(await cutoutBlob.arrayBuffer());
  await fs.writeFile(outPath, cutoutBuf);
}

// ─── Studio gradient achtergrond (lokaal, via canvas) ───
function makeStudioBackground(w: number, h: number): Buffer {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  // Vertical gradient: lichter boven, ietsje donkerder onder (catalog feel)
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#F2F2F2");
  grad.addColorStop(0.6, "#EDEDED");
  grad.addColorStop(1, "#E0E0E0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return canvas.toBuffer("image/png");
}

// ─── Composite: bank cutout op achtergrond, gecentreerd + iets boven onderkant ───
async function compositeOntoBackground(
  cutoutPath: string,
  backgroundBuf: Buffer,
  canvasW: number,
  canvasH: number,
  options: { groundOffset?: number } = {}
): Promise<Buffer> {
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  // 1. Achtergrond op canvas (fit cover)
  const bgImg = await loadImage(backgroundBuf);
  // Cover-fit: schaal zodat hele canvas vol is, knip overschot
  const bgScale = Math.max(canvasW / bgImg.width, canvasH / bgImg.height);
  const bgW = bgImg.width * bgScale;
  const bgH = bgImg.height * bgScale;
  ctx.drawImage(bgImg, (canvasW - bgW) / 2, (canvasH - bgH) / 2, bgW, bgH);

  // 2. Bank cutout: ~85% van canvas-breedte, gecentreerd + iets boven onderkant
  const cutoutBuf = await fs.readFile(cutoutPath);
  const cutoutImg = await loadImage(cutoutBuf);
  const targetW = Math.round(canvasW * 0.85);
  const scale = targetW / cutoutImg.width;
  const targetH = Math.round(cutoutImg.height * scale);
  const left = Math.round((canvasW - targetW) / 2);
  const groundOffset = options.groundOffset ?? Math.round(canvasH * 0.05);
  const top = Math.max(0, canvasH - targetH - groundOffset);
  ctx.drawImage(cutoutImg, left, top, targetW, targetH);

  return canvas.toBuffer("image/png");
}

async function main() {
  console.log(`\n═══ Composite pipeline: ${slug} ═══`);
  console.log(`  Canvas:    ${canvasW}x${canvasH}`);
  console.log(`  Quality:   ${quality} (alleen voor lifestyle bg)`);
  console.log(`  Dry-run:   ${DRY_RUN}\n`);

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
    console.log(`--only filter: ${originals.length} files`);
  }

  if (originals.length === 0) { console.error(`Geen originelen.`); process.exit(1); }

  if (heroFile) {
    const idx = originals.findIndex((f) => f.toLowerCase() === heroFile.toLowerCase());
    if (idx === -1) { console.error(`--hero="${heroFile}" niet gevonden.`); process.exit(1); }
    originals = [originals[idx], ...originals.slice(0, idx), ...originals.slice(idx + 1)];
    console.log(`Hero (studio-1): ${heroFile}`);
  }

  const lifestyleSource = lifestyleFile ?? originals[0];
  if (lifestyleFile && !originals.includes(lifestyleFile)) {
    console.error(`--lifestyle="${lifestyleFile}" niet gevonden.`); process.exit(1);
  }
  if (!SKIP_LIFESTYLE) console.log(`Lifestyle source: ${lifestyleSource}`);
  console.log();

  console.log(`─── Plan ──────────────────────────────────────────────`);
  console.log(`Studio (${originals.length} foto's):`);
  originals.forEach((f, i) => console.log(`  studio-${i + 1}.png  ←  ${f}  (lokaal composite, geen AI)`));
  if (!SKIP_LIFESTYLE) {
    console.log(`Lifestyle (1 foto):`);
    console.log(`  lifestyle-1.png  ←  ${lifestyleSource}  (composite op AI-marmer scene, $0.17)`);
  }
  console.log(`\nAPI cost: ~$${SKIP_LIFESTYLE ? "0.00" : "0.17"} (1x OpenAI text-to-image)`);

  if (DRY_RUN) { console.log("\n[DRY-RUN] Niets uitgevoerd."); return; }

  await fs.mkdir(studioDir, { recursive: true });
  await fs.mkdir(lifestyleDir, { recursive: true });
  await fs.mkdir(cutoutDir, { recursive: true });

  // Stap 1: cutouts
  console.log(`\n─── Background-removal (lokaal) ───`);
  const filesToCut = SKIP_LIFESTYLE ? originals : Array.from(new Set([...originals, lifestyleSource]));
  const cutoutMap: Record<string, string> = {};
  for (const file of filesToCut) {
    const src = path.join(originalsDir, file);
    const dst = path.join(cutoutDir, `${file}.cutout.png`);
    let cached = false;
    try { await fs.access(dst); cached = true; } catch {}
    if (!cached) {
      console.log(`  ⚙  ${file} ...`);
      await makeCutout(src, dst);
    } else {
      console.log(`  ⚡ ${file} (cached)`);
    }
    cutoutMap[file] = dst;
  }

  // Stap 2: studio composites
  console.log(`\n─── Studio composites (lokaal grijze gradient) ───`);
  const studioBg = makeStudioBackground(canvasW, canvasH);
  for (const [i, file] of originals.entries()) {
    const dst = path.join(studioDir, `studio-${i + 1}.png`);
    try {
      console.log(`  [${i + 1}/${originals.length}] ${file} → studio-${i + 1}.png ...`);
      const buf = await compositeOntoBackground(cutoutMap[file], studioBg, canvasW, canvasH);
      await fs.writeFile(dst, buf);
      console.log(`    ✓  ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.error(`    ✗  ${(e as Error).message}`);
    }
  }

  // Stap 3: lifestyle (1x OpenAI bg + composite)
  if (!SKIP_LIFESTYLE) {
    console.log(`\n─── Lifestyle (OpenAI bg + composite) ───`);
    try {
      console.log(`  Genereer marmer-scene via OpenAI...`);
      const bgBuf = await generateBackground(LIFESTYLE_BG_PROMPT, canvasW, canvasH);
      console.log(`    ✓  bg ${(bgBuf.length / 1024).toFixed(0)} KB`);
      // Save bg apart voor debug + re-use bij re-runs
      const bgPath = path.join(cutoutDir, `_lifestyle-bg.png`);
      await fs.writeFile(bgPath, bgBuf);
      // Header-check
      const isPng = bgBuf[0] === 0x89 && bgBuf[1] === 0x50 && bgBuf[2] === 0x4e && bgBuf[3] === 0x47;
      console.log(`    bg header: ${isPng ? "PNG ✓" : `NIET PNG (${[...bgBuf.slice(0,8)].map((b) => b.toString(16)).join(" ")})`}`);

      console.log(`  Composite ${lifestyleSource} op marmer...`);
      const dst = path.join(lifestyleDir, `lifestyle-1.png`);
      // OpenAI's PNG heeft soms ICC profile / non-standard chunks die napi-canvas
      // niet aankan. Re-encode via sharp → schone standaard PNG buffer.
      const bgClean = await sharp(bgPath).png({ compressionLevel: 6, force: true }).toBuffer();
      console.log(`    re-encoded bg: ${(bgClean.length / 1024).toFixed(0)} KB`);
      const buf = await compositeOntoBackground(cutoutMap[lifestyleSource], bgClean, canvasW, canvasH, {
        groundOffset: Math.round(canvasH * 0.08),
      });
      await fs.writeFile(dst, buf);
      console.log(`    ✓  ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.error(`  ✗  ${(e as Error).message}`);
    }
  }

  console.log(`\n✓ Klaar. Bekijk:`);
  console.log(`   ${studioDir}`);
  console.log(`   ${lifestyleDir}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
