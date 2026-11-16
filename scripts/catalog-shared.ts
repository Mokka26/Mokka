// Gedeelde basis voor de catalogus-correctiescripts (verbeterplan 16 nov 2026,
// CON-1, CON-8/9, CON-12/7, CON-13, CON-23).
//
// - Standaard DRY-RUN: leest de database, schrijft voorstellen naar
//   scripts/reports/<script>.json en .csv en wijzigt niets.
// - Pas met --apply wordt geschreven. Eerst gaat er een back-up van de
//   oude waarden naar scripts/reports/backup-<script>-<tijd>.json.
// - Vangrails (gelden in beide standen):
//     * alleen de velden description, name, colorName, specs en source;
//       nooit price, listPrice, stock, hidden, deletedAt, deliveryTime, slug
//       of images;
//     * levertijdteksten blijven letterlijk gelijk ("snelle levering",
//       "levertijd", "werkdagen", "weken", "op bestelling"): een voorstel dat
//       daaraan raakt, wordt geschrapt en als "handmatig" gemeld;
//     * specs-sleutels over levertijd/levering worden nooit gewijzigd.
//
// Draaien: node --env-file=.env.local --import tsx scripts/<script>.ts [--apply]
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const APPLY = process.argv.includes("--apply");
export const db = new PrismaClient();

export type Field = "description" | "name" | "colorName" | "specs" | "source";
const ALLOWED: ReadonlySet<Field> = new Set(["description", "name", "colorName", "specs", "source"]);

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  source: string | null;
  hidden: boolean;
  colorGroup: string | null;
  colorName: string | null;
  sizeName: string | null;
  specs: string | null;
};

export type Change = {
  id: string;
  slug: string;
  name: string;
  category: string;
  field: Field;
  before: string | null;
  after: string | null;
  rules: string[];
};

export type Flag = {
  id: string;
  slug: string;
  name: string;
  category: string;
  field: Field;
  text: string;
  reason: string;
};

export async function loadProducts(): Promise<CatalogProduct[]> {
  return db.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true, slug: true, name: true, description: true, category: true, source: true, hidden: true,
      colorGroup: true, colorName: true, sizeName: true, specs: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export function parseSpecs(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = String(val ?? "");
    return out;
  } catch {
    return {};
  }
}

// ─── Vangrails ──────────────────────────────────────────────────────

/** Levertijd-gerelateerde frasen die nooit mogen veranderen (eigenaar, CON-2). */
const PROTECTED = /snelle levering|levertijd|leverdatum|werkdag(en)?|weken|op bestelling|direct leverbaar|uit voorraad/gi;
const DELIVERY_SPEC_KEY = /^\s*(levertijd|levering|leverdatum)\s*$/i;

function protectedFingerprint(text: string | null): string {
  return (text ?? "").match(PROTECTED)?.map((m) => m.toLowerCase()).join("|") ?? "";
}

function deliverySpecsFingerprint(raw: string | null): string {
  const s = parseSpecs(raw);
  return JSON.stringify(Object.entries(s).filter(([k]) => DELIVERY_SPEC_KEY.test(k)));
}

/**
 * Voeg een voorstel toe als het door de vangrails komt; anders een melding.
 * Geeft true terug als het voorstel is opgenomen.
 */
export function propose(
  changes: Change[],
  flags: Flag[],
  p: CatalogProduct,
  field: Field,
  before: string | null,
  after: string | null,
  rules: string[],
): boolean {
  if (!ALLOWED.has(field)) throw new Error(`Veld ${field} is niet toegestaan`);
  if (before === after || rules.length === 0) return false;
  if (protectedFingerprint(before) !== protectedFingerprint(after)) {
    flags.push({ ...base(p), field, text: before ?? "", reason: `voorstel raakt levertijdtekst (${rules.join(", ")}) — niet opgenomen` });
    return false;
  }
  if (field === "specs" && deliverySpecsFingerprint(before) !== deliverySpecsFingerprint(after)) {
    flags.push({ ...base(p), field, text: before ?? "", reason: "voorstel raakt levertijd-spec — niet opgenomen" });
    return false;
  }
  changes.push({ ...base(p), field, before, after, rules });
  return true;
}

export function flag(flags: Flag[], p: CatalogProduct, field: Field, text: string, reason: string): void {
  flags.push({ ...base(p), field, text, reason });
}

function base(p: CatalogProduct) {
  return { id: p.id, slug: p.slug, name: p.name, category: p.category };
}

// ─── Rapport ────────────────────────────────────────────────────────

const REPORT_DIR = join(process.cwd(), "scripts", "reports");

function csvCell(v: string | null | undefined): string {
  const s = (v ?? "").replace(/\r?\n/g, " ");
  return /[";,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Eén JSON (alles) en één CSV (wijzigingen + meldingen, Excel-vriendelijk met ;). */
export function writeReport(script: string, changes: Change[], flags: Flag[], summary: Record<string, number>): string {
  mkdirSync(REPORT_DIR, { recursive: true });
  const jsonPath = join(REPORT_DIR, `${script}.json`);
  const csvPath = join(REPORT_DIR, `${script}.csv`);
  writeFileSync(
    jsonPath,
    JSON.stringify({ script, generatedAt: new Date().toISOString(), mode: APPLY ? "apply" : "dry-run", summary, changes, flags }, null, 2),
  );
  const header = ["type", "categorie", "slug", "naam", "veld", "regels/reden", "voor", "na"].join(";");
  const rows = [
    ...changes.map((c) => ["wijziging", c.category, c.slug, c.name, c.field, c.rules.join(" + "), c.before, c.after].map(csvCell).join(";")),
    ...flags.map((f) => ["handmatig", f.category, f.slug, f.name, f.field, f.reason, f.text, ""].map(csvCell).join(";")),
  ];
  // BOM zodat Excel de UTF-8-tekens (é, ×, Ø) goed toont.
  writeFileSync(csvPath, "﻿" + [header, ...rows].join("\r\n"));
  return jsonPath;
}

export function printSummary(script: string, changes: Change[], flags: Flag[], reportPath: string, examples = 5): void {
  const byRule = new Map<string, number>();
  for (const c of changes) for (const r of c.rules) byRule.set(r, (byRule.get(r) ?? 0) + 1);
  const products = new Set(changes.map((c) => c.id)).size;
  console.log(`\n${script} — ${APPLY ? "APPLY" : "dry-run"}`);
  console.log(`Voorgestelde wijzigingen: ${changes.length} (op ${products} producten), handmatig te bekijken: ${flags.length}`);
  for (const [r, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${r}: ${n}`);
  console.log(`\nVoorbeelden:`);
  for (const c of changes.slice(0, examples)) {
    console.log(`- [${c.field}] ${c.name}\n    voor: ${clip(c.before)}\n    na:   ${clip(c.after)}`);
  }
  console.log(`\nRapport: ${reportPath} (+ .csv)`);
}

function clip(s: string | null, max = 220): string {
  if (s === null) return "(leeg)";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// ─── Toepassen ──────────────────────────────────────────────────────

/** Schrijft de wijzigingen (alleen bij --apply), met back-up vooraf. */
export async function applyChanges(script: string, changes: Change[]): Promise<void> {
  if (!APPLY) {
    console.log(`\nDry-run: er is niets gewijzigd. Toepassen: node --env-file=.env.local --import tsx scripts/${script}.ts --apply`);
    return;
  }
  if (changes.length === 0) return;
  mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(REPORT_DIR, `backup-${script}-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(changes.map((c) => ({ id: c.id, slug: c.slug, field: c.field, before: c.before })), null, 2));
  console.log(`Back-up: ${backupPath}`);

  const byProduct = new Map<string, Partial<Record<Field, string | null>>>();
  for (const c of changes) {
    if (!ALLOWED.has(c.field)) throw new Error(`Veld ${c.field} is niet toegestaan`);
    byProduct.set(c.id, { ...(byProduct.get(c.id) ?? {}), [c.field]: c.after });
  }
  let done = 0;
  for (const [id, data] of byProduct) {
    const update: { description?: string; name?: string; colorName?: string | null; specs?: string | null; source?: string | null } = {};
    if (data.description !== undefined && data.description !== null) update.description = data.description;
    if (data.name !== undefined && data.name !== null) update.name = data.name;
    if (data.colorName !== undefined) update.colorName = data.colorName;
    if (data.specs !== undefined) update.specs = data.specs;
    if (data.source !== undefined) update.source = data.source;
    await db.product.update({ where: { id }, data: update });
    done++;
  }
  console.log(`Toegepast op ${done} producten.`);
}

export async function run(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

/**
 * Opruimen na het weghalen van een woord: dubbele spaties en een spatie vóór
 * leestekens. Bewust niets anders (geen hoofdletters elders in de tekst).
 */
export function tidy(text: string): string {
  return text.replace(/ {2,}/g, " ").replace(/ ([.,;:])/g, "$1");
}

/**
 * Vervang een patroon met behoud van de hoofdletter van de eerste letter:
 * "De unieke tafel" → (unieke weg) → "De tafel"; "Unieke tafel" → "Tafel".
 */
export function replaceKeepCase(text: string, re: RegExp, replacement: string): string {
  return text.replace(re, (match: string, ...groups: unknown[]) => {
    // groups = [...vangroepen, offset (number), volledige tekst, ...]
    const offsetAt = groups.findIndex((g) => typeof g === "number");
    const caps = groups.slice(0, offsetAt < 0 ? 0 : offsetAt).map((g) => (typeof g === "string" ? g : ""));
    let out = replacement.replace(/\$(\d)/g, (_m, i: string) => caps[Number(i) - 1] ?? "");
    const first = match.charAt(0);
    if (first && first === first.toUpperCase() && first !== first.toLowerCase() && out) {
      out = out.charAt(0).toUpperCase() + out.slice(1);
    }
    return out;
  });
}
