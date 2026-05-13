import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const buf = await readFile("public/catalogus 25.pdf");
const parser = new PDFParse({ data: buf });
const result = await parser.getText();

const page = result.pages?.[47]; // page 48 (0-indexed)
if (!page) throw new Error("p.48 niet gevonden");
console.log("=== RAW TEXT p.48 ===");
console.log(JSON.stringify(page.text));
console.log("\n=== LINES ===");
const lines: string[] = (page.text ?? "").split("\n").map((l: string) => l.trim()).filter(Boolean);
for (const [i, l] of lines.entries()) {
  console.log(`  [${i}] "${l}"  (len=${l.length})`);
}
