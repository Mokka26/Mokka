import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const buf = await readFile("public/catalogus 25.pdf");
const parser = new PDFParse({ data: buf });
const result = await parser.getText();

console.log(`Pages: ${result.pages?.length ?? "?"}`);
console.log(`Total text length: ${result.text?.length ?? 0}`);

// Per-pagina structuur
if (result.pages) {
  for (let i = 0; i < Math.min(20, result.pages.length); i++) {
    const p = result.pages[i];
    console.log(`\n--- Pagina ${i + 1} ---`);
    console.log((p.text ?? "").slice(0, 400));
  }
}
