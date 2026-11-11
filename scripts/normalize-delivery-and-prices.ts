// Verbeterplan nov 2026 — DATA-2 en DATA-4. Voor alle niet-verwijderde producten
// (ook verborgen; hidden/stock/featured/listPrice blijven ongemoeid):
//   1. deliveryTime naar één schrijfwijze:
//        "4-8 weken" → "4 tot 8 weken", "5 werk  dagen" → "Binnen 5 werkdagen",
//        "VRAAG ONZ" (afgekapt) → "Op aanvraag".
//   2. sizeVariants-labels opschonen: Arabisch-Indische cijfers/ruis weg,
//      "200 x 200" → "200 × 200", dubbele spaties weg.
//   3. price = goedkoopste maat met prijs (kaart, JSON-LD en feed tonen "vanaf").
//   4. Namen zonder Turkse combinatie-punt (U+0307, "Ni̇rvana" → "Nirvana") en
//      "İ" → "I": anders vindt de zoekfunctie ze niet en tonen sommige fonts een losse punt.
// Uitverkocht + "Binnen 5 werkdagen" wordt alleen GEMELD: de juiste levertijd
// per leverancier is een beslissing van de eigenaar.
//
// Dry-run: npx tsx --env-file=.env.local scripts/normalize-delivery-and-prices.ts
// Apply:   npx tsx --env-file=.env.local scripts/normalize-delivery-and-prices.ts --apply
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

export function normalizeDelivery(raw: string | null): string | null {
  if (raw === null) return null;
  const t = raw.replace(/\s+/g, " ").trim();
  if (/^vraag on/i.test(t)) return "Op aanvraag";
  const range = t.match(/^(\d+)\s*(?:-|–|tot)\s*(\d+)\s*weken$/i);
  if (range) return `${range[1]} tot ${range[2]} weken`;
  const days = t.match(/^(?:binnen\s+)?(\d+)\s*werk\s*dagen$/i);
  if (days) return `Binnen ${days[1]} werkdagen`;
  return t;
}

export function normalizeSizeLabel(label: string): string {
  return label
    .replace(/[٠-٩۰-۹]/g, "") // Arabisch-Indische cijfers (importruis)
    .replace(/(\d)\s*[xX]\s*(\d)/g, "$1 × $2")
    .replace(/\s+/g, " ")
    .trim();
}

type SizeVariant = { label: string; price?: number; listPrice?: number; [k: string]: unknown };

function parseVariants(raw: string | null): SizeVariant[] | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as SizeVariant[]) : null;
  } catch {
    return null;
  }
}

async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true, hidden: true, stock: true, price: true, deliveryTime: true, sizeVariants: true },
  });

  const updates: Array<{ id: string; slug: string; data: Record<string, unknown>; notes: string[] }> = [];
  const brokenJson: string[] = [];
  const oosFast: string[] = [];

  for (const p of products) {
    const data: Record<string, unknown> = {};
    const notes: string[] = [];

    const name = p.name.replace(/̇/g, "").replace(/İ/g, "I");
    if (name !== p.name) {
      data.name = name;
      notes.push(`naam "${p.name}" → "${name}"`);
    }

    const dt = normalizeDelivery(p.deliveryTime);
    if (dt !== p.deliveryTime) {
      data.deliveryTime = dt;
      notes.push(`levertijd "${p.deliveryTime}" → "${dt}"`);
    }
    if (!p.hidden && p.stock <= 0 && /werkdagen/i.test(dt ?? "")) oosFast.push(p.slug);

    const variants = parseVariants(p.sizeVariants);
    if (p.sizeVariants && !variants) brokenJson.push(p.slug);
    if (variants && variants.length > 0) {
      let labelsChanged = false;
      const cleaned = variants.map((v) => {
        const label = normalizeSizeLabel(v.label);
        if (label !== v.label) {
          labelsChanged = true;
          notes.push(`maat "${v.label}" → "${label}"`);
        }
        return { ...v, label };
      });
      if (labelsChanged) data.sizeVariants = JSON.stringify(cleaned);

      const priced = cleaned.map((v) => v.price).filter((n): n is number => typeof n === "number" && n > 0);
      if (priced.length > 0) {
        const min = Math.min(...priced);
        if (Math.abs(min - p.price) > 0.005) {
          data.price = min;
          notes.push(`prijs €${p.price} → €${min} (goedkoopste maat)`);
        }
      }
    }

    if (Object.keys(data).length > 0) updates.push({ id: p.id, slug: p.slug, data, notes });
  }

  console.log(`${products.length} producten bekeken, ${updates.length} te wijzigen.\n`);
  for (const u of updates) console.log(`- ${u.slug}: ${u.notes.join("; ")}`);
  if (brokenJson.length) console.log(`\n⚠ Kapotte sizeVariants-JSON (handmatig herstellen, checkout weigert deze): ${brokenJson.join(", ")}`);
  if (oosFast.length) {
    console.log(`\nℹ ${oosFast.length} zichtbare uitverkochte producten hebben een levertijd in werkdagen (niet gewijzigd — eigenaar beslist).`);
    console.log(`  Klanten zien die niet (kaart en PDP tonen "Tijdelijk uitverkocht"); wel bij weer op voorraad.`);
    console.log(`  Voorbeelden: ${oosFast.slice(0, 8).join(", ")}`);
  }

  if (!APPLY) {
    console.log("\n(DRY-RUN — niets geschreven. Run met --apply om toe te passen.)");
    return;
  }
  for (const u of updates) {
    await prisma.product.update({ where: { id: u.id }, data: u.data });
  }
  console.log(`\n✓ ${updates.length} producten bijgewerkt. Pagina's verversen binnen een uur (ISR), of via een admin-opslag.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
