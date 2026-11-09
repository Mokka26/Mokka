/**
 * Variantmodel: één model = één `colorGroup`. Binnen een model onderscheidt
 * `sizeName` de maten ("180 cm", "Ø 130 cm") en `colorName` de kleuren. Elke
 * combinatie is een eigen product met eigen URL, prijs, voorraad en foto's.
 *
 * Pure helpers (geen Prisma), gedeeld door de PDP (maat- + kleurkeuze),
 * ProductCard ("Ook in 180 en 220 cm") en de listings.
 */

export interface ModelVariant {
  id: string;
  slug: string;
  sizeName: string | null;
  colorName: string | null;
  colorHex: string | null;
  price: number;
  stock: number;
}

/** Prisma-select voor ModelVariant (zelfde velden overal). */
export const MODEL_VARIANT_SELECT = {
  id: true,
  slug: true,
  sizeName: true,
  colorName: true,
  colorHex: true,
  price: true,
  stock: true,
} as const;

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Eerste getal in het label (bv. "Ø 130 cm" → 130, "180-220 cm" → 180). */
function sizeNumber(label: string): number {
  const m = label.replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

/** Maten van klein naar groot; gelijke getallen alfabetisch. */
export function compareSizes(a: string, b: string): number {
  return sizeNumber(a) - sizeNumber(b) || a.localeCompare(b, "nl");
}

/** Unieke maten van een model, gesorteerd van klein naar groot. */
export function distinctSizes(variants: ReadonlyArray<{ sizeName?: string | null }>): string[] {
  const seen = new Map<string, string>();
  for (const v of variants) {
    const label = v.sizeName?.trim();
    if (label && !seen.has(norm(label))) seen.set(norm(label), label);
  }
  return [...seen.values()].sort(compareSizes);
}

/** Unieke kleuren (op naam, anders hex) van een lijst varianten. */
export function distinctColors<T extends Pick<ModelVariant, "colorName" | "colorHex">>(variants: ReadonlyArray<T>): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of variants) {
    const key = norm(v.colorName) || norm(v.colorHex);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export interface SizeOption {
  label: string;
  /** Product waar deze maatknop naartoe linkt. */
  slug: string;
  /** Prijs van dat product (0 = op aanvraag). */
  price: number;
  inStock: boolean;
  current: boolean;
}

export interface ColorOption {
  slug: string;
  colorName: string | null;
  colorHex: string | null;
  inStock: boolean;
  current: boolean;
}

/**
 * Keuze-opties voor de PDP.
 * - Maten: elke maat linkt naar de variant in dezelfde kleur als nu; bestaat
 *   die kleur niet in die maat, dan de eerste op voorraad (anders de eerste).
 * - Kleuren: alleen de kleuren die in de huidige maat bestaan.
 * Een rij verschijnt pas bij ≥ 2 opties.
 */
export function buildVariantOptions(
  variants: ReadonlyArray<ModelVariant>,
  currentSlug: string,
): { sizes: SizeOption[]; colors: ColorOption[] } {
  const current = variants.find((v) => v.slug === currentSlug);
  if (!current) return { sizes: [], colors: [] };

  const sizeLabels = distinctSizes(variants);
  const sizes: SizeOption[] =
    sizeLabels.length < 2
      ? []
      : sizeLabels.map((label) => {
          const inSize = variants.filter((v) => norm(v.sizeName) === norm(label));
          const target =
            inSize.find((v) => v.slug === currentSlug) ??
            inSize.find((v) => norm(v.colorName) !== "" && norm(v.colorName) === norm(current.colorName)) ??
            inSize.find((v) => v.stock > 0) ??
            inSize[0];
          return {
            label,
            slug: target.slug,
            price: target.price,
            inStock: inSize.some((v) => v.stock > 0),
            current: norm(label) === norm(current.sizeName),
          };
        });

  const sameSize = variants.filter((v) => norm(v.sizeName) === norm(current.sizeName));
  // Huidig product vooraan in de dedupe, zodat de eigen kleur nooit wegvalt.
  const colorRows = distinctColors([current, ...sameSize.filter((v) => v.slug !== currentSlug)]);
  const colors: ColorOption[] =
    colorRows.length < 2
      ? []
      : colorRows
          .map((v) => ({
            slug: v.slug,
            colorName: v.colorName,
            colorHex: v.colorHex,
            inStock: v.stock > 0,
            current: v.slug === currentSlug,
          }))
          .sort((a, b) => (a.colorName ?? "").localeCompare(b.colorName ?? "", "nl"));

  return { sizes, colors };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Achtergrond van een kleurstaal. `colorHex` is "#RRGGBB" (één kleur) of
 * "#RRGGBB/#RRGGBB" (stof / onderstel: tweekleurig, diagonaal gedeeld) —
 * dat laatste bij modellen waar alleen het onderstel verschilt.
 * Ongeldige waarden → undefined (geen ongefilterde CSS uit de database).
 */
export function swatchBackground(colorHex: string | null | undefined): { background: string } | undefined {
  if (!colorHex) return undefined;
  const [a, b] = colorHex.split("/").map((s) => s.trim());
  if (!HEX_RE.test(a)) return undefined;
  if (!b || !HEX_RE.test(b)) return { background: a };
  return { background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)` };
}

/** "180 en 220 cm" / "Ø 120, Ø 130 en Ø 150 cm": korte maatlijst voor de kaart. */
export function formatSizeList(labels: ReadonlyArray<string>): string {
  if (labels.length === 0) return "";
  const unit = labels.every((l) => /\bcm$/i.test(l.trim())) ? " cm" : "";
  const bare = unit ? labels.map((l) => l.trim().replace(/\s*cm$/i, "")) : [...labels];
  const list = bare.length === 1 ? bare[0] : `${bare.slice(0, -1).join(", ")} en ${bare[bare.length - 1]}`;
  return `${list}${unit}`;
}

/**
 * Eén product per model: behoudt de volgorde, kiest per colorGroup het eerste
 * product (de aanroeper sorteert de beste representant vooraan). Producten
 * zonder groep blijven staan.
 */
export function onePerModel<T extends { colorGroup?: string | null }>(products: ReadonlyArray<T>): T[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (!p.colorGroup) return true;
    if (seen.has(p.colorGroup)) return false;
    seen.add(p.colorGroup);
    return true;
  });
}

/** Stabiel: op voorraad eerst, uitverkocht achteraan (volgorde verder gelijk). */
export function inStockFirst<T extends { stock?: number }>(products: ReadonlyArray<T>): T[] {
  const available = (p: T) => (p.stock ?? 1) > 0;
  return [...products.filter(available), ...products.filter((p) => !available(p))];
}
