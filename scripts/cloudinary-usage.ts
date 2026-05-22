// Cloudinary account usage — vergelijk wat Media Library toont vs. originals.
// Shows: total assets (incl. derived/transformations), storage usage, transformations.

import { config } from "dotenv";
config({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function main() {
  // Account usage stats — toont wat console toont
  const usage = await cloudinary.api.usage();

  console.log("\n═══ Cloudinary account usage ═══\n");
  console.log("─── Resources ───");
  console.log(`  Total resources:    ${usage.resources ?? "n/a"}`);
  console.log(`  Derived resources:  ${usage.derived_resources ?? "n/a"}  ← cached transformations`);

  console.log("\n─── Storage ───");
  if (usage.storage) {
    console.log(`  Used:   ${((usage.storage.usage ?? 0) / 1024 / 1024).toFixed(1)} MB`);
    console.log(`  Limit:  ${((usage.storage.limit ?? 0) / 1024 / 1024 / 1024).toFixed(2)} GB`);
  }

  console.log("\n─── Bandwidth (deze maand) ───");
  if (usage.bandwidth) {
    console.log(`  Used:   ${((usage.bandwidth.usage ?? 0) / 1024 / 1024).toFixed(1)} MB`);
  }

  console.log("\n─── Transformations (deze maand) ───");
  if (usage.transformations) {
    console.log(`  Count:  ${usage.transformations.usage ?? 0}`);
  }

  // Sample 5 random producten en toon derived-count per asset
  console.log("\n─── Sample: derived per asset ───");
  const sample = await cloudinary.api.resources({
    type: "upload",
    prefix: "mokka",
    max_results: 5,
  } as Parameters<typeof cloudinary.api.resources>[0]);

  for (const r of sample.resources) {
    const detail = await cloudinary.api.resource(r.public_id, { derived_next_cursor: undefined } as Parameters<typeof cloudinary.api.resource>[1]);
    const derivedCount = Array.isArray(detail.derived) ? detail.derived.length : 0;
    console.log(`  ${r.public_id.padEnd(50)} ${derivedCount} derived versions`);
  }

  console.log("\nTip: derived zijn auto-gegenereerde transformaties (e_upscale, w_1400, etc.)");
  console.log("Veilig te verwijderen — Cloudinary regenereert on-demand bij eerste request.");
  console.log("Run: scripts/destroy-all-derived.ts om alle derived te flushen.\n");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
