/**
 * Worker: doet alleen background removal via @imgly/background-removal-node.
 * Wordt aangeroepen door scripts/import-starline.ts in een aparte subprocess
 * om sharp DLL-conflicten te vermijden (@imgly bundelt sharp 0.32, root heeft
 * sharp 0.34 — beide laden libvips-42.dll en clashen).
 *
 * Gebruik:
 *   node scripts/starline-cutout-worker.mjs <input.jpg> <output.png>
 */

import { readFile, writeFile } from "node:fs/promises";
import { removeBackground } from "@imgly/background-removal-node";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("usage: cutout-worker <input> <output>");
  process.exit(1);
}

const input = await readFile(inputPath);
// Detecteer mime via magic bytes — @imgly raadt het anders niet
const mime =
  input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff
    ? "image/jpeg"
    : input[0] === 0x89 && input[1] === 0x50 && input[2] === 0x4e
      ? "image/png"
      : "application/octet-stream";

const blob = new Blob([input], { type: mime });
const result = await removeBackground(blob);
const ab = await result.arrayBuffer();
await writeFile(outputPath, Buffer.from(ab));
console.error(`cutout: ${outputPath}`);
