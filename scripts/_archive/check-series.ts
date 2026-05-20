import { readFile } from "node:fs/promises";

interface P { name: string; }
const data: P[] = JSON.parse(await readFile("scripts/app4sales-products.json", "utf8"));

const series = new Set<string>();
for (const p of data) {
  const first = (p.name ?? "").split(/\s+/)[0];
  series.add(first);
}
console.log("Series gevonden in JSON:");
for (const s of Array.from(series).sort()) console.log(`  ${s}`);

console.log("\nEdition 72 tegels — gevonden in onze JSON?");
for (const want of ["MONZA", "OSLO", "TRAVERTINE", "DESIGN", "OLIVIA", "TAKSIM", "KIMBERLY"]) {
  console.log(`  ${want}: ${series.has(want) ? "ja" : "NEE"}`);
}
