// Normaliseert productspecificaties voor ALLE niet-verwijderde producten
// (ook verborgen; hidden/price/listPrice/stock/featured blijven ongemoeid):
//   1. specs.Afmetingen → canoniek formaat ("B 120 × D 60 × H 45 cm", "Ø 120 cm");
//      ontbreekt de maat, dan afleiden uit naam, beschrijving of slug (alleen
//      bij een eenduidig patroon zoals "120x60x45", "160×200", "Ø 120").
//   2. specs.Materiaal afleiden uit naam/beschrijving (alleen bij precies één
//      materiaalwoord uit lib/specs.ts).
//   3. Spec-sleutels: typefouten, aliassen, Categorie/Levertijd weg, vaste volgorde.
//   4. deliveryTime zetten waar leeg: per bron (zelfde tabel als
//      scripts/set-delivery-times.ts), anders de meest voorkomende waarde van
//      dezelfde bron.
//   5. colorHex aanvullen waar colorName bekend is (COLOR_HEX in lib/specs.ts).
// Gedeelde beschrijvingen (bv. 5 plafondlampen) worden alleen gemeld.
//
// Dry-run: npx tsx scripts/normalize-specs.ts
// Apply:   npx tsx scripts/normalize-specs.ts --apply
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import {
  colorHexFor,
  deriveMaterial,
  formatDimensions,
  normalizeSpecKeys,
  parseDimensions,
  parseSpecs,
  plausibleDimensions,
  stripProductCode,
} from "../lib/specs";

/** Categorieën waar één materiaalwoord in de beschrijving het hele product dekt (bekleding/armatuur). */
const DESC_MATERIAL_CATEGORIES = new Set([
  "eetkamerstoelen", "fauteuils", "poefs", "hoekbanken", "bankstellen", "banken",
  "plafondlampen", "vloerlampen", "tafellampen", "wandlampen", "verlichting",
]);

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const SAMPLE = 12;

// Zelfde tabel als scripts/set-delivery-times.ts (bron → levertijd).
const WEKEN = "4 tot 8 weken";
const DAGEN = "Binnen 5 werkdagen";
const DELIVERY_BY_SOURCE: Record<string, string> = {
  nive: WEKEN, nevi: WEKEN, saltanat: WEKEN, mumza: WEKEN, "one world": WEKEN,
  bss: DAGEN, bambi: DAGEN, "bss bambi": DAGEN, rousseau: DAGEN, "great home": DAGEN, livingfurn: DAGEN,
};
const normSource = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Eén eenduidige maat-tekst uit vrije tekst: "Ø 120", "120×60×45", "160 x 200 cm". */
function dimensionSnippet(text: string): string | null {
  const t = text.replace(/(\d),(\d)/g, "$1.$2");
  const circle = t.match(/[Øø⌀]\s*(\d{2,3}(?:\.\d+)?)(?:\s*(?:cm)?\s*[×xX]\s*[Hh]?\s*(\d{2,3}(?:\.\d+)?))?/);
  const multi = [...t.matchAll(/(?<![\d.])(\d{2,3}(?:\.\d+)?)\s*[×xX]\s*(\d{2,3}(?:\.\d+)?)(?:\s*[×xX]\s*(\d{1,3}(?:\.\d+)?))?(?![\d.])/g)];
  if (multi.length > 1) return null; // meerdere maten (sets) → niet gokken
  if (circle) return circle[2] ? `Ø ${circle[1]} × H ${circle[2]}` : `Ø ${circle[1]}`;
  if (multi.length === 1) return multi[0][0];
  return null;
}

/** Slug-variant: alleen "120x60x45" / "160x200" zonder decimalen, precies één keer. */
function slugDimensionSnippet(slug: string): string | null {
  const hits = [...slug.matchAll(/(?<![\d])(\d{2,3})x(\d{2,3})(?:x(\d{1,3}))?(?![\d])/g)];
  return hits.length === 1 ? hits[0][0] : null;
}

type Row = {
  id: string; slug: string; name: string; category: string; source: string | null; specs: string | null;
  description: string; deliveryTime: string | null; colorName: string | null; colorHex: string | null;
};

async function main() {
  console.log(`\n═══ normalize-specs — ${APPLY ? "APPLY (live)" : "dry-run"} ═══`);
  const rows: Row[] = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true, category: true, source: true, specs: true, description: true, deliveryTime: true, colorName: true, colorHex: true },
  });

  // Meest voorkomende levertijd per bron (fallback voor bronnen buiten de tabel).
  const deliveryBySource = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.source || !r.deliveryTime) continue;
    const m = deliveryBySource.get(normSource(r.source)) ?? deliveryBySource.set(normSource(r.source), new Map()).get(normSource(r.source))!;
    m.set(r.deliveryTime, (m.get(r.deliveryTime) ?? 0) + 1);
  }
  const majorityDelivery = (source: string | null): string | null => {
    if (!source) return null;
    const m = deliveryBySource.get(normSource(source));
    if (!m) return null;
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  const counts: Record<string, number> = {};
  const samples: Record<string, string[]> = {};
  const note = (key: string, text: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
    (samples[key] ??= []);
    if (samples[key].length < SAMPLE) samples[key].push(text);
  };

  const updates: { id: string; slug: string; data: { specs?: string; deliveryTime?: string; colorHex?: string } }[] = [];
  const sharedDescriptions = new Map<string, string[]>();

  for (const r of rows) {
    const original = parseSpecs(r.specs);
    const specs = normalizeSpecKeys(original);
    const data: { specs?: string; deliveryTime?: string; colorHex?: string } = {};

    // 1. Afmetingen
    if (specs.Afmetingen) {
      if (/matrasmaten/i.test(specs.Afmetingen)) note("afmetingenMeerdereMatenGelaten", `${r.slug}: ${specs.Afmetingen}`);
      else {
        const parsed = parseDimensions(specs.Afmetingen, r.category);
        const canonical = plausibleDimensions(r.category, parsed) ? formatDimensions(parsed) : null;
        if (!canonical) note("afmetingenOnleesbaarGelaten", `${r.slug}: ${specs.Afmetingen}`);
        else if (canonical !== specs.Afmetingen) {
          note("afmetingenGenormaliseerd", `${r.slug}: "${specs.Afmetingen}" → "${canonical}"`);
          specs.Afmetingen = canonical;
        }
      }
    } else {
      const fromName = dimensionSnippet(stripProductCode(r.name));
      const fromDesc = fromName ? null : dimensionSnippet(r.description);
      const fromSlug = fromName || fromDesc ? null : slugDimensionSnippet(r.slug);
      const snippet = fromName ?? fromDesc ?? fromSlug;
      const parsed = snippet ? parseDimensions(snippet, r.category) : null;
      const canonical = plausibleDimensions(r.category, parsed) ? formatDimensions(parsed) : null;
      if (canonical) {
        const via = fromName ? "naam" : fromDesc ? "beschrijving" : "slug";
        note(`afmetingenAfgeleidUit:${via}`, `${r.slug}: "${snippet}" → "${canonical}"  [${r.name}]`);
        specs.Afmetingen = canonical;
      } else note("afmetingenOntbreektNogSteeds", `${r.slug} [${r.name}]`);
    }

    // 2. Materiaal
    if (!specs.Materiaal) {
      const fromName = deriveMaterial(stripProductCode(r.name));
      // Uit de beschrijving alleen voor bekleding/armaturen; bij tafels dekt één woord
      // ("metalen voet") niet het hele product.
      const fromDesc = fromName || !DESC_MATERIAL_CATEGORIES.has(r.category) ? null : deriveMaterial(r.description);
      const material = fromName ?? fromDesc;
      if (material) {
        note(`materiaalAfgeleidUit:${fromName ? "naam" : "beschrijving"}`, `${r.slug}: ${material}  [${r.name}]`);
        specs.Materiaal = material;
      } else note("materiaalOntbreektNogSteeds", `${r.slug} [${r.name}]`);
    }

    // 3. Sleutels (volgorde, Categorie/Levertijd weg, typefouten)
    const ordered = normalizeSpecKeys(specs);
    const newJson = JSON.stringify(ordered);
    if (newJson !== (r.specs ?? "")) {
      const removed = Object.keys(original).filter((k) => !(k in ordered));
      if (removed.length) note("specSleutelsVerwijderd", `${r.slug}: ${removed.join(", ")}`);
      const renamed = Object.keys(original).filter((k) => !(k in ordered) && !/^(categorie|levertijd|levertijdken|levering)$/i.test(k));
      if (renamed.length) note("specSleutelsHernoemd", `${r.slug}: ${renamed.join(", ")}`);
      note("specsGewijzigd", r.slug);
      data.specs = newJson;
    }

    // 4. Levertijd
    if (!r.deliveryTime) {
      const mapped = r.source ? DELIVERY_BY_SOURCE[normSource(r.source)] : undefined;
      const delivery = mapped ?? majorityDelivery(r.source);
      if (delivery) {
        note("levertijdGezet", `${r.slug} (${r.source ?? "-"}) → ${delivery}${mapped ? "" : " (meest voorkomend bij bron)"}`);
        data.deliveryTime = delivery;
      } else note("levertijdOnbekendGelaten", `${r.slug} (${r.source ?? "-"})`);
    }

    // 5. colorHex
    if (r.colorName && !r.colorHex) {
      const hex = colorHexFor(r.colorName);
      if (hex) {
        note("colorHexAangevuld", `${r.slug}: ${r.colorName} → ${hex}`);
        data.colorHex = hex;
      } else note("colorHexOnbekendGelaten", `${r.slug}: ${r.colorName}`);
    }

    if (Object.keys(data).length > 0) updates.push({ id: r.id, slug: r.slug, data });

    const descKey = r.description.trim().slice(0, 200).toLowerCase();
    if (descKey) (sharedDescriptions.get(descKey) ?? sharedDescriptions.set(descKey, []).get(descKey)!).push(r.slug);
  }

  console.log(`\nProducten: ${rows.length} · te wijzigen rijen: ${updates.length}\n`);
  for (const key of Object.keys(counts).sort()) {
    console.log(`${key.padEnd(40)} ${String(counts[key]).padStart(5)}`);
    for (const s of samples[key]) console.log(`      · ${s}`);
  }
  const shared = [...sharedDescriptions.values()].filter((v) => v.length > 1);
  console.log(`\nGedeelde beschrijvingen (niet gewijzigd): ${shared.length} groepen, ${shared.reduce((n, v) => n + v.length, 0)} producten`);
  for (const group of shared.filter((v) => v.length >= 5).slice(0, 5)) console.log(`      · ${group.length}× ${group.slice(0, 3).join(", ")} …`);

  if (!APPLY) {
    console.log("\n(DRY-RUN — run met --apply)");
    await prisma.$disconnect();
    return;
  }
  let done = 0;
  for (const u of updates) {
    await prisma.product.update({ where: { id: u.id }, data: u.data });
    done++;
    if (done % 200 === 0) console.log(`  … ${done}/${updates.length}`);
  }
  console.log(`\n✅ Toegepast: ${done} rijen bijgewerkt (specs: ${updates.filter((u) => u.data.specs).length}, levertijd: ${updates.filter((u) => u.data.deliveryTime).length}, colorHex: ${updates.filter((u) => u.data.colorHex).length}).`);
  console.log("ISR ververst de pagina's binnen een uur (revalidate 3600).");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
