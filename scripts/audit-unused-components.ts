// Vind components/lib bestanden die nergens worden geïmporteerd.
//
// Strategie: per bestand, grep voor import-statements die het bestand
// noemen. Geen matches = unused.

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SEARCH_DIRS = ["components", "lib", "hooks", "context"];
// Bestanden die altijd "gebruikt" zijn ook al niet expliciet imported
const ALWAYS_KEEP = new Set<string>([
  "components/admin/AdminSidebar.tsx", // gebruikt in admin layout
]);

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function grepUsage(file: string): Promise<number> {
  // Tel hoeveel andere .ts/.tsx files dit bestand importeren.
  // We zoeken op de relatieve pad-naam of de bestandsnaam.
  const rel = file.replace(ROOT + path.sep, "").replace(/\\/g, "/");
  const basename = path.basename(file, path.extname(file));
  const importPath = rel.replace(/\.(tsx?|jsx?)$/, "");

  // Build search patterns
  const patterns = [
    `from "@/${importPath}"`,
    `from "./${basename}"`,
    `from "../${basename}"`,
    `from "@/${importPath.split("/").slice(0, -1).join("/")}/${basename}"`,
  ];

  let count = 0;
  const allFiles = await getAllSourceFiles();
  for (const f of allFiles) {
    if (f === file) continue;
    try {
      const content = await fs.readFile(f, "utf-8");
      for (const pat of patterns) {
        if (content.includes(pat)) {
          count++;
          break;
        }
      }
    } catch {
      // skip
    }
  }
  return count;
}

let _allFiles: string[] | null = null;
async function getAllSourceFiles(): Promise<string[]> {
  if (_allFiles) return _allFiles;
  const dirs = ["app", "components", "lib", "hooks", "context", "scripts"];
  const out: string[] = [];
  for (const d of dirs) {
    try {
      out.push(...(await walk(path.join(ROOT, d))));
    } catch {}
  }
  _allFiles = out;
  return out;
}

async function main() {
  console.log("═══ Unused component/lib audit ═══\n");

  const candidates: string[] = [];
  for (const dir of SEARCH_DIRS) {
    try {
      candidates.push(...(await walk(path.join(ROOT, dir))));
    } catch {}
  }

  console.log(`Total source files to check: ${candidates.length}\n`);

  const unused: string[] = [];
  for (const file of candidates) {
    const rel = file.replace(ROOT + path.sep, "").replace(/\\/g, "/");
    if (ALWAYS_KEEP.has(rel)) continue;
    const usages = await grepUsage(file);
    if (usages === 0) {
      unused.push(rel);
    }
  }

  console.log(`UNUSED (${unused.length}):\n`);
  for (const f of unused.sort()) console.log(`  ${f}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
