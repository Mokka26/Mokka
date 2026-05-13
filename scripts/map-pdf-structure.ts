/**
 * Scan alle 81 pagina's van de catalogus, classificeer per pagina:
 *   - bank (heeft "Opstelling:" of "Hoek:")
 *   - matras (heeft "Maat: ...cm x ...cm")
 *   - other (cover, intro, blanke pagina's)
 * Output: JSON met per pagina { num, type, name, raw }
 */

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const buf = await readFile("public/catalogus 25.pdf");
const parser = new PDFParse({ data: buf });
const result = await parser.getText();

interface PageInfo {
  num: number;
  type: "bank" | "matras" | "other";
  name: string | null;
  text: string;
}

const pages: PageInfo[] = [];

for (let i = 0; i < (result.pages?.length ?? 0); i++) {
  const text: string = (result.pages![i].text ?? "").trim();
  const num = i + 1;

  // Naam = eerste niet-lege regel die geen spec-pattern is
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let name: string | null = null;
  for (const l of lines) {
    if (
      !l.startsWith("Maat:") &&
      !l.startsWith("Opstelling") &&
      !l.startsWith("Voorraad") &&
      !l.startsWith("Zittingen") &&
      !l.startsWith("Arm:") &&
      !l.startsWith("Hoek:") &&
      !l.startsWith("OTM") &&
      !l.startsWith("OTT") &&
      !l.startsWith("Totaal") &&
      !l.match(/^\d+(\.\d+)?(cm|CM)/) &&
      !l.match(/^[A-Z]+\+/) &&
      l.length < 50
    ) {
      name = l;
      break;
    }
  }

  let type: PageInfo["type"] = "other";
  if (text.includes("Opstelling") || text.includes("Hoek:") || text.includes("Zittingen:")) {
    type = "bank";
  } else if (/Maat:\s*\d+cm\s*x\s*\d+cm/i.test(text)) {
    type = "matras";
  }

  pages.push({ num, type, name, text });
}

// Samenvatting
const banks = pages.filter((p) => p.type === "bank");
const matrassen = pages.filter((p) => p.type === "matras");
const others = pages.filter((p) => p.type === "other");

console.log(`Totaal ${pages.length} pagina's:`);
console.log(`  Banken: ${banks.length}`);
console.log(`  Matrassen: ${matrassen.length}`);
console.log(`  Other: ${others.length}`);

console.log(`\n=== BANKEN ===`);
for (const p of banks) console.log(`  p.${p.num.toString().padStart(2)} — ${p.name ?? "(?)"}`);

console.log(`\n=== MATRASSEN ===`);
for (const p of matrassen) console.log(`  p.${p.num.toString().padStart(2)} — ${p.name ?? "(?)"}`);

console.log(`\n=== OTHER ===`);
for (const p of others) console.log(`  p.${p.num.toString().padStart(2)} — ${p.text.slice(0, 80).replace(/\n/g, " | ")}`);

await writeFile(
  "scripts/pdf-pages.json",
  JSON.stringify(pages, null, 2),
);
console.log(`\nSaved scripts/pdf-pages.json`);
