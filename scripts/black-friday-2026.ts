// Black Friday 2026 (t/m 30 november): korting per categorie en leverancier.
//
// - De huidige verkoopprijs wordt de doorgestreepte prijs (listPrice) — dat is
//   de laagste prijs van de afgelopen 30 dagen (Omnibus-richtlijn). De nieuwe
//   prijs = huidige prijs × (1 − korting), naar beneden afgerond op hele euro's.
// - Maatvarianten (bedden) krijgen per maat dezelfde behandeling.
// - Opties (nachtkastjes, voetbank, 1-zitsbank) krijgen géén korting.
// - Alleen zichtbare, niet-verwijderde producten met een prijs > 0.
// - Categorie gaat vóór leverancier (een hoekbank van NIVE krijgt 20%).
//
// Standaard DRY-RUN. Schrijven:
//   node --env-file=.env.local --import tsx scripts/black-friday-2026.ts --apply
// Na de actie terugzetten (eerst zonder --apply om te zien wat er gebeurt):
//   node --env-file=.env.local --import tsx scripts/black-friday-2026.ts --revert --apply
//
// --apply schrijft eerst de oude waarden naar scripts/reports/black-friday-2026-state.json
// en weigert als dat bestand al bestaat (geen dubbele korting). --revert zet
// precies die waarden terug, slaat producten over waarvan de prijs sinds
// --apply met de hand is gewijzigd, en hernoemt het bestand daarna.
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CATEGORY_RULES: Record<string, number> = { hoekbanken: 20, bankstellen: 20 };
// Sleutel = source in kleine letters, spaties samengevoegd.
const SOURCE_RULES: Record<string, number> = {
  rousseau: 15,
  "great home": 10,
  bambi: 10,
  "bss bambi": 10,
  bss: 10,
  "one world": 10,
  livingfurn: 10,
  mumza: 20,
  "twenty bedding": 10,
};

const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.includes("--revert");
const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const STATE_PATH = join(REPORT_DIR, "black-friday-2026-state.json");
const db = new PrismaClient();

type Row = { id: string; slug: string; name: string; category: string; source: string | null; price: number; listPrice: number | null; sizeVariants: string | null };
type Saved = { id: string; slug: string; old: { price: number; listPrice: number | null; sizeVariants: string | null }; new: { price: number; listPrice: number; sizeVariants: string | null } };

const norm = (s: string | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function percentFor(p: Row): number | null {
  return CATEGORY_RULES[p.category] ?? SOURCE_RULES[norm(p.source)] ?? null;
}

const cut = (price: number, pct: number) => Math.floor(price * (1 - pct / 100));

function discountVariants(raw: string | null, pct: number): string | null {
  if (!raw) return raw;
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!Array.isArray(arr)) return raw;
  const out = arr.map((v: unknown) => {
    if (!v || typeof v !== "object") return v;
    const rec = v as Record<string, unknown>;
    if (typeof rec.price !== "number" || rec.price <= 0) return v;
    return { ...rec, listPrice: rec.price, price: cut(rec.price, pct) };
  });
  return JSON.stringify(out);
}

async function apply(): Promise<void> {
  if (APPLY && existsSync(STATE_PATH)) {
    console.error(`Afgebroken: ${STATE_PATH} bestaat al — de korting staat er waarschijnlijk al op. Eerst --revert.`);
    process.exitCode = 1;
    return;
  }
  const rows: Row[] = await db.product.findMany({
    where: { deletedAt: null, hidden: false, price: { gt: 0 } },
    select: { id: true, slug: true, name: true, category: true, source: true, price: true, listPrice: true, sizeVariants: true },
    orderBy: [{ source: "asc" }, { category: "asc" }, { name: "asc" }],
  });

  const todo: Saved[] = [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const perGroup = new Map<string, { n: number; pct: number }>();
  for (const p of rows) {
    const pct = percentFor(p);
    if (pct == null) continue;
    todo.push({
      id: p.id,
      slug: p.slug,
      old: { price: p.price, listPrice: p.listPrice, sizeVariants: p.sizeVariants },
      new: { price: cut(p.price, pct), listPrice: p.price, sizeVariants: discountVariants(p.sizeVariants, pct) },
    });
    const key = `${p.source ?? "(geen)"} | ${p.category}`;
    perGroup.set(key, { n: (perGroup.get(key)?.n ?? 0) + 1, pct });
  }

  console.log(`${rows.length} zichtbare producten met prijs, ${todo.length} krijgen korting, ${rows.length - todo.length} niet.\n`);
  for (const [k, v] of perGroup) console.log(`  ${String(v.pct).padStart(2)}%  ${k}: ${v.n}`);
  console.log("\nVoorbeeld per groep:");
  const seen = new Set<string>();
  for (const t of todo) {
    const r = byId.get(t.id);
    if (!r) continue;
    const key = `${r.source}|${r.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const variants = t.new.sizeVariants !== t.old.sizeVariants ? ` | maten: ${t.new.sizeVariants}` : "";
    console.log(`  ${r.name}: € ${t.old.price} → € ${t.new.price} (doorgestreept € ${t.new.listPrice})${variants}`);
  }
  const hadList = todo.filter((t) => t.old.listPrice != null);
  if (hadList.length) {
    console.log(`\n${hadList.length} hiervan hadden al een doorgestreepte prijs; die wordt nu de huidige prijs:`);
    for (const t of hadList) console.log(`  ${t.slug}: was-prijs € ${t.old.listPrice} → € ${t.new.listPrice}, prijs € ${t.old.price} → € ${t.new.price}`);
  }

  if (!APPLY) {
    console.log("\nDry-run: er is niets gewijzigd.");
    return;
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(todo, null, 2));
  console.log(`\nOude waarden opgeslagen: ${STATE_PATH}`);
  let n = 0;
  for (const t of todo) {
    await db.product.update({ where: { id: t.id }, data: t.new });
    n++;
  }
  console.log(`${n} producten afgeprijsd. Pagina's tonen dit na de volgende revalidatie (max. 1 uur).`);
}

async function revert(): Promise<void> {
  if (!existsSync(STATE_PATH)) {
    console.error(`Geen ${STATE_PATH}: er is niets terug te zetten.`);
    process.exitCode = 1;
    return;
  }
  const saved = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Saved[];
  const current = await db.product.findMany({ where: { id: { in: saved.map((s) => s.id) } }, select: { id: true, price: true } });
  const priceNow = new Map(current.map((c) => [c.id, c.price]));
  const ok = saved.filter((s) => priceNow.get(s.id) === s.new.price);
  const skipped = saved.filter((s) => priceNow.has(s.id) && priceNow.get(s.id) !== s.new.price);
  console.log(`${saved.length} in de back-up, ${ok.length} terug te zetten, ${skipped.length} overgeslagen (prijs met de hand gewijzigd).`);
  for (const s of skipped) console.log(`  overgeslagen: ${s.slug} (nu € ${priceNow.get(s.id)}, verwacht € ${s.new.price})`);
  if (!APPLY) {
    console.log("\nDry-run: er is niets gewijzigd. Terugzetten: --revert --apply");
    return;
  }
  for (const s of ok) await db.product.update({ where: { id: s.id }, data: s.old });
  renameSync(STATE_PATH, STATE_PATH.replace(".json", `-teruggezet-${new Date().toISOString().replace(/[:.]/g, "-")}.json`));
  console.log(`${ok.length} producten teruggezet.`);
}

(REVERT ? revert() : apply())
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
