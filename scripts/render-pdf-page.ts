/**
 * Render een specifieke PDF-pagina als PNG via pdfjs-dist + @napi-rs/canvas.
 * Gebruik: npx tsx scripts/render-pdf-page.ts <pageNum> [scale]
 */

import { readFile, writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

const pageNum = parseInt(process.argv[2] ?? "1", 10);
const scale = parseFloat(process.argv[3] ?? "2.5");

const buf = await readFile("public/catalogus 25.pdf");
const data = new Uint8Array(buf);
const doc = await pdfjsLib.getDocument({ data }).promise;
console.log(`Pages: ${doc.numPages}`);

const page = await doc.getPage(pageNum);
const viewport = page.getViewport({ scale });
console.log(`Page ${pageNum}: ${Math.floor(viewport.width)}x${Math.floor(viewport.height)}`);

const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
const ctx = canvas.getContext("2d");

await page.render({
  canvasContext: ctx as unknown as CanvasRenderingContext2D,
  viewport,
} as unknown as Parameters<typeof page.render>[0]).promise;

const out = `C:/Users/konia/AppData/Local/Temp/page-${pageNum}.png`;
await writeFile(out, canvas.toBuffer("image/png"));
console.log(`saved: ${out}`);
