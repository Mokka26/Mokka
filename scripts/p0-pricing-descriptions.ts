/**
 * P0 vervolg:
 *   - Variabele prijzen voor placeholder-banken (per type/stof)
 *   - Verrijkte beschrijvingen per bank op basis van stof + type
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

// Prijs-buckets per type (basis + stof-multiplier)
const TYPE_BASE_PRICE: Record<string, number> = {
  Hoekbank: 2199,
  Loungebank: 1499,
  "U-Bank": 2499,
  Bank: 1299,
};

// Premium-stof = hogere prijs
const FABRIC_MULTIPLIER: Record<string, number> = {
  monolith: 1.15,   // structured premium
  kronos: 1.10,
  croco: 1.18,      // exclusive
  "genova texarm": 1.12,
  riviera: 1.0,     // standard
  kemer: 1.0,       // standard
  magic: 1.05,
  preston: 1.08,
  soro: 1.05,
  fresh: 0.95,
  "relax decowit": 1.02,
};

interface BankSpec {
  Serie?: string;
  Categorie?: string;
  Stoffering?: string;
  Materiaal?: string;
  Levertijd?: string;
}

function buildDescription(name: string, spec: BankSpec): string {
  const serie = spec.Serie ?? name.split(/\s+/)[0];
  const type = spec.Categorie ?? "Bank";
  const stof = spec.Stoffering;

  const intro: Record<string, string> = {
    Hoekbank: `${serie} is een royale hoekbank die de hoek van je woonkamer verandert in een centrale lounge.`,
    Loungebank: `${serie} is een lage loungebank gemaakt voor lange middagen en ontspannen avonden.`,
    "U-Bank": `${serie} is een U-vormige bank die ruimte deelt zonder de woonkamer te claimen — perfect voor sociaal gebruik.`,
    Bank: `${serie} combineert sculpturale lijnen met genereus zitcomfort.`,
  };

  const stofText = stof
    ? ` De ${stof}-stoffering is zorgvuldig geselecteerd op duurzaamheid en textuur — een tactiele afwerking die met de jaren karakter krijgt.`
    : "";

  const closing = ` Handgemaakt in Nederland naar Mokka's specificaties, met aandacht voor materialiteit en zitcomfort.`;

  return (intro[type] ?? intro.Bank) + stofText + closing;
}

function computePrice(spec: BankSpec): number {
  const type = spec.Categorie ?? "Bank";
  const base = TYPE_BASE_PRICE[type] ?? 1299;
  const stof = spec.Stoffering?.toLowerCase() ?? "";
  const mult = FABRIC_MULTIPLIER[stof] ?? 1.0;
  // Rond af op €50
  return Math.round((base * mult) / 50) * 50 - 1;
}

const banken = await prisma.$queryRaw<Array<{
  id: string; slug: string; name: string; description: string;
  price: number; specs: string | null;
}>>`
  SELECT id, slug, name, description, price, specs FROM "Product"
  WHERE category IN ('banken','hoekbanken') AND hidden = false
`;

console.log(`Process ${banken.length} zichtbare banken/hoekbanken\n`);

let priceUpdated = 0;
let descUpdated = 0;
for (const b of banken) {
  let specs: BankSpec = {};
  try { specs = JSON.parse(b.specs ?? "{}"); } catch {}

  const newPrice = computePrice(specs);
  const newDesc = buildDescription(b.name, specs);

  const data: { price?: number; description?: string } = {};
  // Update prijs alleen als placeholder (€1499 default)
  if (b.price === 1499 && newPrice !== 1499) {
    data.price = newPrice;
    priceUpdated++;
  }
  // Update beschrijving als generic / template
  const isGeneric = b.description?.includes("modulaire bank") ||
    b.description?.includes("premium kwaliteit") ||
    b.description?.includes("sculpturale lijnen en premium stoffering") ||
    b.description?.length < 100;
  if (isGeneric && newDesc !== b.description) {
    data.description = newDesc;
    descUpdated++;
  }

  if (Object.keys(data).length > 0) {
    await prisma.product.update({ where: { id: b.id }, data });
    if (data.price !== undefined) {
      console.log(`  ${b.slug.padEnd(38)} €${b.price} → €${data.price}`);
    }
  }
}

console.log(`\n=== Resultaat ===`);
console.log(`  Prijzen aangepast: ${priceUpdated}`);
console.log(`  Beschrijvingen aangepast: ${descUpdated}`);

await prisma.$disconnect();
