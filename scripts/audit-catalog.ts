// Catalogus-audit (alleen-lezen, wijzigt niets). Telt per kwaliteitscriterium
// hoeveel zichtbare en verborgen producten erop vallen, met voorbeeld-slugs.
// Verwijderde producten (deletedAt) tellen niet mee.
//
// Tekst:  npx tsx scripts/audit-catalog.ts
// JSON:   npx tsx scripts/audit-catalog.ts --json            (alle voorbeeld-slugs, max 25 per punt)
// Opties: --examples=N   aantal voorbeelden per punt in de tekstweergave (default 5)
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { parseImages } from "../lib/imageHelpers";
import { findProductCode, isCanonicalDimensions, parseDimensions, parseSpecs } from "../lib/specs";

const prisma = new PrismaClient();
const JSON_OUT = process.argv.includes("--json");
const EXAMPLES = Number(process.argv.find((a) => a.startsWith("--examples="))?.split("=")[1] ?? "5");

const ENGLISH_SLUG_WORDS = new Set([
  "chair", "chairs", "ceiling", "floor", "table", "wall", "lamp", "mirror", "decoration", "sofa", "bed",
  "white", "black", "gold", "silver", "brown", "grey", "gray", "cream", "with", "led", "light", "legs",
  "corner", "dining", "coffee", "side", "cabinet", "wardrobe", "dresser", "nightstand", "armchair",
  "stool", "round", "oval", "square", "green", "blue", "red", "pink", "velvet", "ceramic", "marble",
  "glass", "wood", "wooden", "steel", "metal", "clear", "smoke", "feather",
]);

type Row = {
  id: string;
  slug: string;
  name: string;
  category: string;
  source: string | null;
  specs: string | null;
  images: string;
  price: number;
  listPrice: number | null;
  stock: number;
  deliveryTime: string | null;
  colorGroup: string | null;
  colorName: string | null;
  colorHex: string | null;
  hidden: boolean;
  description: string;
  sizeVariants: string | null;
};

type Bucket = { zichtbaar: number; verborgen: number; voorbeelden: string[] };

class Metric {
  readonly buckets = new Map<string, Bucket>();
  add(key: string, row: Row, example = row.slug): void {
    const b = this.buckets.get(key) ?? { zichtbaar: 0, verborgen: 0, voorbeelden: [] };
    if (row.hidden) b.verborgen++;
    else b.zichtbaar++;
    if (b.voorbeelden.length < 25) b.voorbeelden.push(example);
    this.buckets.set(key, b);
  }
}

function isEnglishSlug(slug: string): boolean {
  return slug.split("-").some((t) => ENGLISH_SLUG_WORDS.has(t));
}

function sizeVariantsWithoutPrice(raw: string | null): number {
  if (!raw) return 0;
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return 0;
    return arr.filter((v) => !v || typeof v !== "object" || typeof (v as { price?: unknown }).price !== "number" || (v as { price: number }).price <= 0).length;
  } catch {
    return 0;
  }
}

async function main() {
  const rows: Row[] = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true, slug: true, name: true, category: true, source: true, specs: true, images: true, price: true,
      listPrice: true, stock: true, deliveryTime: true, colorGroup: true, colorName: true, colorHex: true,
      hidden: true, description: true, sizeVariants: true,
    },
  });

  const perCategorie = new Metric();
  const perBron = new Metric();
  const punten = new Metric();
  const namen = new Map<string, Row[]>();
  const beschrijvingen = new Map<string, Row[]>();
  const groepen = new Map<string, Row[]>();

  for (const r of rows) {
    perCategorie.add(r.category, r);
    perBron.add(r.source ?? "(geen bron)", r);
    const specs = parseSpecs(r.specs);
    const images = parseImages(r.images);
    const first = images[0];

    if (images.length === 0) punten.add("zonderFoto", r);
    if (images.length === 1) punten.add("eenFoto", r);
    if (first) {
      if (!first.w || !first.h) punten.add("fotoAfmetingOnbekend", r);
      else {
        if (first.h > first.w) punten.add("eersteFotoPortrait", r);
        if (first.w < 800) punten.add("eersteFotoKlein", r);
      }
    }
    if (!r.specs || Object.keys(specs).length === 0) punten.add("zonderSpecs", r);
    if (!specs.Afmetingen) punten.add("zonderAfmetingen", r);
    else if (/matrasmaten/i.test(specs.Afmetingen)) punten.add("afmetingenMeerdereMaten", r);
    else if (!isCanonicalDimensions(specs.Afmetingen, r.category)) {
      punten.add(parseDimensions(specs.Afmetingen, r.category) ? "afmetingenAfwijkendFormaat" : "afmetingenOnleesbaar", r, `${r.slug} (${specs.Afmetingen})`);
    }
    if (!specs.Materiaal) punten.add("zonderMateriaal", r);
    if (findProductCode(r.name)) punten.add("codeInNaam", r, `${r.slug} (${r.name})`);
    if (isEnglishSlug(r.slug)) punten.add("engelseSlug", r);
    if (r.name.length > 70) punten.add("naamLangerDan70", r);
    if (Object.keys(specs).some((k) => /^categorie$/i.test(k))) punten.add("specsMetCategorie", r);
    if (Object.keys(specs).some((k) => /^levertijd/i.test(k))) punten.add("specsMetLevertijd", r);
    if (r.price <= 0) punten.add("prijs0", r);
    if (r.listPrice !== null && r.listPrice < r.price) punten.add("listPriceLagerDanPrijs", r);
    if (!r.deliveryTime) punten.add("zonderLevertijd", r, `${r.slug} (${r.source ?? "-"})`);
    if (r.stock <= 0) punten.add("voorraad0", r);
    if (sizeVariantsWithoutPrice(r.sizeVariants) > 0) punten.add("maatvariantZonderPrijs", r);
    if (r.colorName && !r.colorHex) punten.add("kleurnaamZonderHex", r, `${r.slug} (${r.colorName})`);
    if (r.colorGroup && !r.colorName) punten.add("kleurgroepZonderKleurnaam", r);
    if (r.colorGroup) (groepen.get(r.colorGroup) ?? groepen.set(r.colorGroup, []).get(r.colorGroup)!).push(r);
    const nameKey = r.name.trim().toLowerCase();
    (namen.get(nameKey) ?? namen.set(nameKey, []).get(nameKey)!).push(r);
    const descKey = r.description.trim().slice(0, 200).toLowerCase();
    if (descKey) (beschrijvingen.get(descKey) ?? beschrijvingen.set(descKey, []).get(descKey)!).push(r);
  }
  // Dubbele namen: alleen onder zichtbare producten (verborgen tellen apart).
  for (const [, group] of namen) {
    const visible = group.filter((r) => !r.hidden);
    if (visible.length > 1) for (const r of visible) punten.add("dubbeleNaam", r, `${r.slug} (${r.name})`);
    const hidden = group.filter((r) => r.hidden);
    if (hidden.length > 1) for (const r of hidden) punten.add("dubbeleNaam", r, `${r.slug} (${r.name})`);
  }
  for (const [, group] of beschrijvingen) {
    if (group.length > 1) for (const r of group) punten.add("gedeeldeBeschrijving", r);
  }
  for (const [, group] of groepen) {
    if (group.filter((r) => !r.hidden).length === 1) for (const r of group) if (!r.hidden) punten.add("kleurgroepMetEenZichtbaarLid", r);
  }

  const totaal = { zichtbaar: rows.filter((r) => !r.hidden).length, verborgen: rows.filter((r) => r.hidden).length };
  const toObject = (m: Metric) => Object.fromEntries([...m.buckets.entries()].sort((a, b) => b[1].zichtbaar + b[1].verborgen - (a[1].zichtbaar + a[1].verborgen)));
  const result = {
    datum: new Date().toISOString().slice(0, 10),
    totaal,
    perCategorie: toObject(perCategorie),
    perBron: toObject(perBron),
    punten: toObject(punten),
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n═══ Catalogus-audit ${result.datum} — ${totaal.zichtbaar} zichtbaar · ${totaal.verborgen} verborgen ═══`);
    const table = (title: string, data: Record<string, Bucket>, examples: boolean) => {
      console.log(`\n── ${title} ──`);
      console.log(`${"".padEnd(34)} ${"zichtb.".padStart(8)} ${"verb.".padStart(8)}`);
      for (const [k, b] of Object.entries(data)) {
        console.log(`${k.padEnd(34)} ${String(b.zichtbaar).padStart(8)} ${String(b.verborgen).padStart(8)}`);
        if (examples && EXAMPLES > 0) for (const e of b.voorbeelden.slice(0, EXAMPLES)) console.log(`      · ${e}`);
      }
    };
    table("Per categorie", result.perCategorie, false);
    table("Per bron", result.perBron, false);
    table("Kwaliteitspunten", result.punten, true);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
