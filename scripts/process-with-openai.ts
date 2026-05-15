// Process originelen via OpenAI gpt-image-1 image edit endpoint.
//
// Voor elke foto in photos-todo/<slug>/originals/:
//   - Stuurt naar OpenAI met studio-prompt → save als studio/studio-N.jpg
//   - Eerste foto krijgt EXTRA lifestyle pass → save als lifestyle/lifestyle-1.jpg
//
// Vereist OPENAI_API_KEY in .env.local.
//
// Run:
//   OPENAI_API_KEY=$(grep "^OPENAI_API_KEY" .env.local | cut -d= -f2-) \
//     npx tsx scripts/process-with-openai.ts <slug>
//
// Flags:
//   --dry-run        rapport zonder API-calls of file writes
//   --quality=low    low|medium|high (default medium, ~$0.04/img low, ~$0.16/img high)
//   --skip-lifestyle alleen studio, geen woonkamer-versie

import { promises as fs } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const DRY_RUN = args.includes("--dry-run");
const SKIP_LIFESTYLE = args.includes("--skip-lifestyle");
const quality = (args.find((a) => a.startsWith("--quality="))?.split("=")[1] ?? "medium") as
  "low" | "medium" | "high";

if (!slug) {
  console.error("Usage: tsx scripts/process-with-openai.ts <slug> [--dry-run] [--quality=low|medium|high] [--skip-lifestyle]");
  process.exit(1);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY && !DRY_RUN) {
  console.error("OPENAI_API_KEY niet gevonden. Voeg toe aan .env.local.");
  process.exit(1);
}

const ROOT = process.cwd();
const todoDir = path.join(ROOT, "photos-todo", slug);
const originalsDir = path.join(todoDir, "originals");
const studioDir = path.join(todoDir, "studio");
const lifestyleDir = path.join(todoDir, "lifestyle");

// ─── Prompts ───
const STUDIO_PROMPT =
  "Replace the background with a clean, uniform warm bone-colored studio backdrop (hex #EEEAE3). " +
  "Add a soft, natural drop-shadow directly below the sofa to ground it on the floor. " +
  "Preserve the sofa EXACTLY as in the original: do not alter its shape, color, fabric texture, or pillows. " +
  "The final image should look like a premium catalog product photo with even, soft lighting from the front-top. " +
  "No text, no logos, no other furniture or props.";

const LIFESTYLE_PROMPT =
  "Place this sofa in a beautifully styled wabi-sabi living room. " +
  "Background: warm bone-colored plaster walls, light oak parquet floor, " +
  "soft natural daylight streaming from the left through linen curtains. " +
  "Add minimal styling: a terracotta accent throw pillow nearby, a small ceramic vase on a low side table. " +
  "Preserve the sofa EXACTLY as in the original — do not change its shape, color, or fabric. " +
  "Premium editorial interior photography style, photorealistic, no text, no logos.";

// ─── OpenAI call ───
async function editImage(imagePath: string, prompt: string): Promise<Buffer> {
  const imageBuf = await fs.readFile(imagePath);
  const fileName = path.basename(imagePath);

  // Multipart form-data — gebruik native FormData (Node 18+)
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("quality", quality);
  form.append("output_format", "jpeg");
  form.append("image", new Blob([imageBuf]), fileName);

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errorText.slice(0, 300)}`);
  }
  const json = await res.json() as { data: { b64_json: string }[] };
  if (!json.data?.[0]?.b64_json) {
    throw new Error(`OpenAI response onverwacht: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return Buffer.from(json.data[0].b64_json, "base64");
}

async function main() {
  console.log(`\n═══ OpenAI process: ${slug} ═══`);
  console.log(`  Bron:     ${originalsDir}`);
  console.log(`  Quality:  ${quality}`);
  console.log(`  Dry-run:  ${DRY_RUN}\n`);

  let originals: string[];
  try {
    originals = (await fs.readdir(originalsDir))
      .filter((f) => /\.(png|jpe?g)$/i.test(f))
      // Skip specificatie-tekeningen en size-edits
      .filter((f) => !/specificat|size edit|allinhouse4/i.test(f))
      .sort();
  } catch {
    console.error(`Geen originals/ folder gevonden in ${todoDir}. Run eerst organize-hoekbank-originals.ts.`);
    process.exit(1);
  }

  if (originals.length === 0) {
    console.error(`Geen originelen gevonden in ${originalsDir}.`);
    process.exit(1);
  }

  console.log(`─── Plan ──────────────────────────────────────────────`);
  console.log(`Studio (${originals.length} foto's):`);
  originals.forEach((f, i) => console.log(`  studio-${i + 1}.jpg  ←  ${f}`));
  if (!SKIP_LIFESTYLE) {
    console.log(`Lifestyle (1 foto):`);
    console.log(`  lifestyle-1.jpg  ←  ${originals[0]}  (zelfde als studio-1)`);
  }
  const calls = originals.length + (SKIP_LIFESTYLE ? 0 : 1);
  const costEstimate = { low: 0.011, medium: 0.042, high: 0.167 }[quality] * calls;
  console.log(`\nTotaal API calls: ${calls}  ·  geschatte kosten: $${costEstimate.toFixed(2)} (${quality} quality)`);

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] Geen API calls + geen file writes.");
    return;
  }

  await fs.mkdir(studioDir, { recursive: true });
  await fs.mkdir(lifestyleDir, { recursive: true });

  console.log(`\n─── Bezig met OpenAI (kan even duren, ~5-30s per foto) ───`);
  for (const [i, file] of originals.entries()) {
    const src = path.join(originalsDir, file);
    const dst = path.join(studioDir, `studio-${i + 1}.jpg`);
    try {
      console.log(`  [${i + 1}/${originals.length}] ${file} → studio-${i + 1}.jpg ...`);
      const buf = await editImage(src, STUDIO_PROMPT);
      await fs.writeFile(dst, buf);
      console.log(`    ✓  ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.error(`    ✗  ${(e as Error).message}`);
    }
  }

  if (!SKIP_LIFESTYLE) {
    const src = path.join(originalsDir, originals[0]);
    const dst = path.join(lifestyleDir, `lifestyle-1.jpg`);
    try {
      console.log(`  [lifestyle] ${originals[0]} → lifestyle-1.jpg ...`);
      const buf = await editImage(src, LIFESTYLE_PROMPT);
      await fs.writeFile(dst, buf);
      console.log(`    ✓  ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.error(`    ✗  ${(e as Error).message}`);
    }
  }

  console.log(`\n✓ Klaar. Bekijk de output in:`);
  console.log(`   ${studioDir}`);
  console.log(`   ${lifestyleDir}`);
  console.log(`\nVolgende stap (na visuele check):`);
  console.log(`   DATABASE_URL=... npx tsx scripts/import-hoekbank-photos.ts ${slug}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
