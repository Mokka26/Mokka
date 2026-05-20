// Destroy alle Cloudinary orphan-assets uit cloudinary-orphans.json.
// Sequential met rate-limit pauze tussen calls.
//
// Run:
//   npx tsx scripts/destroy-cloudinary-orphans.ts --apply
//   npx tsx scripts/destroy-cloudinary-orphans.ts                 (dry-run)
//   npx tsx scripts/destroy-cloudinary-orphans.ts --apply --skip=mokka/banken (skip prefix)

import { config } from "dotenv";
config({ path: ".env.local" });

import { v2 as cloudinary } from "cloudinary";
import { promises as fs } from "node:fs";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const APPLY = process.argv.includes("--apply");
const skipPrefix = process.argv.find((a) => a.startsWith("--skip="))?.split("=")[1];

async function main() {
  const raw = await fs.readFile("cloudinary-orphans.json", "utf-8");
  let publicIds = JSON.parse(raw) as string[];

  if (skipPrefix) {
    const before = publicIds.length;
    publicIds = publicIds.filter((p) => !p.startsWith(skipPrefix));
    console.log(`Skipping prefix "${skipPrefix}": ${before - publicIds.length} excluded`);
  }

  console.log(`Total to destroy: ${publicIds.length}`);
  console.log(`Apply: ${APPLY}\n`);

  if (!APPLY) {
    console.log("[DRY-RUN] Run met --apply om te destroyen.");
    return;
  }

  let ok = 0;
  let fail = 0;
  const start = Date.now();

  for (let i = 0; i < publicIds.length; i++) {
    const pid = publicIds[i];
    try {
      await cloudinary.uploader.destroy(pid, { invalidate: true });
      ok++;
    } catch (e) {
      fail++;
      console.error(`  ✗ ${pid}: ${(e as Error).message}`);
    }
    if ((i + 1) % 50 === 0) {
      const elapsed = (Date.now() - start) / 1000;
      const rate = (i + 1) / elapsed;
      const eta = (publicIds.length - i - 1) / rate;
      process.stdout.write(
        `  ${i + 1}/${publicIds.length}  ok=${ok}  fail=${fail}  rate=${rate.toFixed(1)}/s  eta=${(eta / 60).toFixed(1)}m\n`,
      );
    }
  }

  console.log(`\n✓ Klaar. Destroy: ${ok}, fail: ${fail}, time: ${((Date.now() - start) / 1000 / 60).toFixed(1)}m`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
