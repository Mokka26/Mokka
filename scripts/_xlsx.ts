import { readFileSync } from "node:fs";
const dir = process.argv[2];
const ss = readFileSync(`${dir}/xl/sharedStrings.xml`, "utf8");
// elke <si> = één string (kan meerdere <t> runs hebben)
const strings: string[] = [];
for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  const txt = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("");
  strings.push(txt.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">"));
}
const sheet = readFileSync(`${dir}/xl/worksheets/sheet1.xml`, "utf8");
const colNum = (ref: string) => { const c = ref.replace(/\d+/g,""); let n=0; for(const ch of c) n=n*26+(ch.charCodeAt(0)-64); return n-1; };
const rows: string[][] = [];
for (const rm of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells: string[] = [];
  for (const cm of rm[2].matchAll(/<c r="([A-Z]+\d+)"(?:[^>]*t="([^"]*)")?[^>]*>([\s\S]*?)<\/c>/g)) {
    const ci = colNum(cm[1]); const t = cm[2]; const vm = cm[3].match(/<v>([\s\S]*?)<\/v>/);
    let val = vm ? vm[1] : "";
    if (t === "s") val = strings[Number(val)] ?? "";
    cells[ci] = val;
  }
  rows.push(cells);
}
for (const r of rows) console.log(r.map(c => c ?? "").join(" | "));
