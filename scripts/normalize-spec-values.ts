// Verbeterplan nov 2026 — DATA-7: één schrijfwijze voor specificatiewaarden, zodat
// filters en productpagina's niet "Mango hout" naast "Mangohout" tonen.
//   1. specs.Materiaal → vaste termen (zie MATERIAL).
//   2. specs.Serie: generieke importwoorden (CEILING, MIRROR, …) weg; namen in
//      HOOFDLETTERS → gewone schrijfwijze ("KIMBERLY" → "Kimberly").
//   3. colorName: na "/" kleine letter ("Wit/Goud" → "Wit/goud").
// Raakt geen prijs, voorraad, naam, slug, foto's of zichtbaarheid.
//
// Dry-run: npx tsx --env-file=.env.local scripts/normalize-spec-values.ts
// Apply:   npx tsx --env-file=.env.local scripts/normalize-spec-values.ts --apply
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const MATERIAL: Record<string, string> = {
  "Mango hout": "Mangohout",
  "Sinter Stone": "Keramiek / sintersteen",
  Travertijn: "Travertin",
  "Bouclé-stof": "Bouclé",
  PU: "Kunstleer (PU)",
  "Marmer, Faux Marmer": "Marmerlook",
};

/** Importruis die geen serienaam is. */
const GENERIC_SERIES = new Set(["CEILING", "MIRROR", "WALL", "FLOOR", "TABLE", "DECORATION"]);

export function normalizeMaterial(v: string): string {
  return MATERIAL[v.trim()] ?? v;
}

/** null = sleutel weghalen. */
export function normalizeSeries(v: string): string | null {
  const t = v.trim();
  if (GENERIC_SERIES.has(t)) return null;
  if (t === t.toUpperCase() && /[A-Z]{3}/.test(t)) {
    return t.toLowerCase().replace(/(^|\s|-)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  }
  return t;
}

export function normalizeColorName(v: string): string {
  return v.replace(/\/\s*([A-ZÀ-Ý])/g, (_m, c: string) => `/${c.toLowerCase()}`);
}

async function main() {
  const rows = await db.product.findMany({ where: { deletedAt: null }, select: { id: true, slug: true, colorName: true, specs: true } });
  const updates: Array<{ id: string; data: { specs?: string; colorName?: string } }> = [];
  const tally: Record<string, number> = {};
  const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);

  for (const r of rows) {
    const data: { specs?: string; colorName?: string } = {};
    if (r.specs) {
      let specs: Record<string, unknown> | null = null;
      try {
        const parsed: unknown = JSON.parse(r.specs);
        specs = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
      } catch {
        specs = null;
      }
      if (specs) {
        let changed = false;
        if (typeof specs.Materiaal === "string") {
          const m = normalizeMaterial(specs.Materiaal);
          if (m !== specs.Materiaal) { bump(`Materiaal "${specs.Materiaal}" → "${m}"`); specs.Materiaal = m; changed = true; }
        }
        if (typeof specs.Serie === "string") {
          const s = normalizeSeries(specs.Serie);
          if (s === null) { bump(`Serie "${specs.Serie}" → (weg)`); delete specs.Serie; changed = true; }
          else if (s !== specs.Serie) { bump(`Serie "${specs.Serie}" → "${s}"`); specs.Serie = s; changed = true; }
        }
        if (changed) data.specs = JSON.stringify(specs);
      }
    }
    if (r.colorName) {
      const c = normalizeColorName(r.colorName);
      if (c !== r.colorName) { bump(`Kleur "${r.colorName}" → "${c}"`); data.colorName = c; }
    }
    if (Object.keys(data).length) updates.push({ id: r.id, data });
  }

  console.log(`${rows.length} producten bekeken, ${updates.length} te wijzigen.\n`);
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}× ${k}`);
  if (!APPLY) {
    console.log("\n(DRY-RUN — niets geschreven. Run met --apply om toe te passen.)");
    return;
  }
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await db.$transaction(batch.map((u) => db.product.update({ where: { id: u.id }, data: u.data })));
  }
  console.log(`\n✓ ${updates.length} producten bijgewerkt.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
