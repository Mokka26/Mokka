/**
 * Gedeelde parsers voor productdata (specs-JSON, maatvarianten, afmetingen).
 * Eén keer parsen, met try/catch en type guards — gebruikt door ProductCard
 * en de productpagina zodat beide dezelfde lezing van de data hebben.
 */

export type SpecMap = Record<string, string>;

export function parseSpecs(raw: string | null | undefined): SpecMap {
  if (!raw) return {};
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: SpecMap = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
      else if (typeof v === "number" && Number.isFinite(v)) out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** Zoekt een spec op sleutel, hoofdletterongevoelig, eerste match wint. */
export function findSpec(specs: SpecMap, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (specs[key]) return specs[key];
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(specs)) {
      if (k.toLowerCase() === lower && v) return v;
    }
  }
  return undefined;
}

export const DIMENSION_KEYS = ["Afmetingen", "Afmeting", "Maten", "Maat", "Size", "Dimensions"] as const;
export const DELIVERY_KEY_RE = /^\s*(levertijd|levering|leverdatum|levertermijn)\s*$/i;

export type SizeVariant = { label: string; price?: number; listPrice?: number };

export function parseSizeVariants(raw: string | null | undefined): SizeVariant[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((v: unknown): SizeVariant[] => {
      if (!v || typeof v !== "object") return [];
      const rec = v as Record<string, unknown>;
      if (typeof rec.label !== "string" || !rec.label.trim()) return [];
      return [
        {
          label: rec.label.trim(),
          ...(typeof rec.price === "number" && rec.price > 0 ? { price: rec.price } : {}),
          ...(typeof rec.listPrice === "number" && rec.listPrice > 0 ? { listPrice: rec.listPrice } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * Grootste van de eerste twee maten in een afmetingen-string (cm). Bij
 * "220 x 100 x 76 cm" is dat 220 (lengte/breedte); bij "B 280 × D 95" ook 280.
 */
export function extractWidthCm(dimensions: string | undefined): number | null {
  if (!dimensions) return null;
  const nums = (dimensions.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map((n) => Number(n.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n >= 30 && n <= 600);
  if (nums.length === 0) return null;
  return Math.max(...nums.slice(0, 2));
}

const TABLE_CATEGORIES = new Set(["eettafels", "tafels"]);
const SOFA_CATEGORIES = new Set(["banken", "hoekbanken", "bankstellen"]);

/**
 * Praktische context bij de afmetingen (CLAUDE.md §3: "maatvoering met
 * praktische context"). Alleen waar we iets zinnigs kunnen zeggen.
 */
export function dimensionContext(category: string, dimensions: string | undefined): string | null {
  const width = extractWidthCm(dimensions);
  if (width === null) return null;
  if (TABLE_CATEGORIES.has(category)) {
    if (width >= 220) return "Plaats voor 8 tot 10 personen.";
    if (width >= 180) return "Plaats voor 6 tot 8 personen.";
    if (width >= 140) return "Plaats voor 4 tot 6 personen.";
    return null;
  }
  if (SOFA_CATEGORIES.has(category)) {
    const w = Number.isInteger(width) ? String(width) : width.toFixed(0);
    return `Breedte ${w} cm — meet even de wand of hoek waar de bank komt te staan.`;
  }
  return null;
}

/** Nieuw-badge: aangemaakt in de laatste 30 dagen. */
export function isNewProduct(createdAt: Date | string | undefined | null, now = Date.now()): boolean {
  if (!createdAt) return false;
  const t = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return now - t < 30 * 24 * 60 * 60 * 1000;
}
