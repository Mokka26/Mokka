/**
 * Helpers voor product-image storage met natuurlijke aspect ratios.
 *
 * Storage formaat in Product.images (JSON string):
 *   [{ url, w, h }, ...]   — nieuw, met dimensies
 *   ["url", ...]           — oud, alleen URLs (backwards-compat)
 *
 * Parser handelt beide af. Nieuwe uploads via ImageManager slaan
 * altijd het nieuwe formaat op.
 */

/**
 * Achtergrondtype van een foto, bepaald door scripts/classify-image-backgrounds.ts:
 * - "plain": vrijstaand product op een effen rand (wit/grijs studio) → opvullen
 *   tot het kader in de randkleur (Cloudinary c_pad + b_auto) is onzichtbaar.
 * - "scene": sfeerfoto (kamer, woonopstelling) → slim bijsnijden (c_fill + g_auto),
 *   want opvullen geeft daar een zichtbare gekleurde band.
 * Ontbreekt het veld (nieuwe import/upload), dan wordt veilig opgevuld.
 */
export type ImageBackground = "plain" | "scene";

export type ProductImage = {
  url: string;
  w?: number;
  h?: number;
  /** Optionele alt-tekst per foto (bv. "zijaanzicht"); leeg → productnaam. */
  alt?: string;
  bg?: ImageBackground;
};

function toBackground(value: unknown): ImageBackground | undefined {
  return value === "plain" || value === "scene" ? value : undefined;
}

/**
 * Kadermodus voor `cldOptimize`: "contain" (c_pad + b_auto) voor vrijstaande
 * foto's en onbekende foto's, "fill" (c_fill + g_auto) voor sfeerfoto's.
 */
export function frameMode(img: Pick<ProductImage, "bg"> | undefined): "contain" | "fill" {
  return img?.bg === "scene" ? "fill" : "contain";
}

function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
}

export function parseImages(raw: string | null | undefined): ProductImage[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((item: unknown): ProductImage[] => {
      if (typeof item === "string") {
        const url = item.trim();
        return url.length > 0 ? [{ url }] : [];
      }
      if (!item || typeof item !== "object") return [];
      const rec = item as Record<string, unknown>;
      // Tolerant: `url` of `src`, dimensies als number óf numerieke string.
      const urlRaw = typeof rec.url === "string" ? rec.url : typeof rec.src === "string" ? rec.src : "";
      const url = urlRaw.trim();
      if (!url) return [];
      const w = toPositiveNumber(rec.w ?? rec.width);
      const h = toPositiveNumber(rec.h ?? rec.height);
      const alt = typeof rec.alt === "string" && rec.alt.trim() ? rec.alt.trim() : undefined;
      const bg = toBackground(rec.bg);
      return [{ url, ...(w ? { w } : {}), ...(h ? { h } : {}), ...(alt ? { alt } : {}), ...(bg ? { bg } : {}) }];
    });
  } catch {
    return [];
  }
}

export function imageUrls(raw: string | null | undefined): string[] {
  return parseImages(raw).map((i) => i.url);
}

export function firstImageUrl(raw: string | null | undefined): string | null {
  const arr = parseImages(raw);
  return arr.length > 0 ? arr[0].url : null;
}

/**
 * Trimt een images-JSON tot alléén de eerste foto (zelfde opslagformaat).
 * Voor listing-payloads: ProductCard toont alleen foto 1, dus de overige
 * 10-70 URL's per product mee-serialiseren is pure payload-ballast.
 */
export function firstImageOnly(raw: string): string {
  const arr = parseImages(raw);
  return JSON.stringify(arr.length > 0 ? [arr[0]] : []);
}

/**
 * Aspect ratio voor CSS aspect-ratio property. Default 1 als dims onbekend.
 */
export function imageAspect(img: ProductImage | undefined, fallback = 1): number {
  if (!img || !img.w || !img.h) return fallback;
  return img.w / img.h;
}
