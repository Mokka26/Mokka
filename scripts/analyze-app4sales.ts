import { readFile } from "node:fs/promises";

interface Product {
  code: string; name: string; price: number | null; originalPrice: number | null;
  imageUrl: string; inStock: boolean; catalogEdition: string;
}

const data: Product[] = JSON.parse(await readFile("scripts/app4sales-products.json", "utf8"));

console.log(`Totaal: ${data.length} producten\n`);

console.log("Eerste 20 producten:");
for (const p of data.slice(0, 20)) {
  console.log(`  ${p.code.padEnd(12)} EUR ${(p.price ?? 0).toString().padStart(7)}  ${p.name}`);
}

console.log("\nNaam-prefixes (clue voor categorie):");
const prefixes = new Map<string, number>();
for (const p of data) {
  const first = (p.name ?? "").split(/\s+/)[0];
  prefixes.set(first, (prefixes.get(first) ?? 0) + 1);
}
for (const [k, v] of Array.from(prefixes.entries()).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}

console.log("\nCategorie-keywords detectie (gebaseerd op subdomein in naam):");
const keywords: Record<string, RegExp> = {
  "eettafels": /\bDT\b|\bTAFEL\b|\bTABLE\b|\bDINING\b/i,
  "salontafels": /\bCT\b|\bCOFFEE\b|\bSALON\b/i,
  "stoelen": /\bCHAIR\b|\bSTOEL\b/i,
  "spiegels": /\bMIRROR\b|\bSPIEGEL\b/i,
  "kasten": /\bCABINET\b|\bKAST\b|\bCONSOLE\b|\bSIDEBOARD\b/i,
  "verlichting": /\bLAMP\b|\bLIGHT\b|\bCHANDELIER\b/i,
};
const cats = new Map<string, number>();
for (const p of data) {
  let matched = false;
  for (const [cat, re] of Object.entries(keywords)) {
    if (re.test(p.name)) {
      cats.set(cat, (cats.get(cat) ?? 0) + 1);
      matched = true;
      break;
    }
  }
  if (!matched) cats.set("ONBEKEND", (cats.get("ONBEKEND") ?? 0) + 1);
}
for (const [k, v] of Array.from(cats.entries())) console.log(`  ${k}: ${v}`);

console.log("\nVoorbeelden per onbekend (eerste 10):");
const onbekend = data.filter((p) => {
  for (const re of Object.values(keywords)) if (re.test(p.name)) return false;
  return true;
});
for (const p of onbekend.slice(0, 10)) console.log(`  ${p.name}`);
