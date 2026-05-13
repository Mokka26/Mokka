/**
 * Lees alle tekst uit catalogus 25.pdf om de structuur te begrijpen.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const buf = await readFile("public/catalogus 25.pdf");
const parser = new PDFParse({ data: buf });
const result = await parser.getText();

console.log(`Pages: ${result.pages?.length ?? "?"}`);
const text: string = result.text ?? "";
console.log(`Total text length: ${text.length}`);
console.log(`\n=== EERSTE 5000 CHARS ===`);
console.log(text.slice(0, 5000));
console.log(`\n=== LAATSTE 2000 CHARS ===`);
console.log(text.slice(-2000));
