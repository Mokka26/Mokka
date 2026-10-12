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

export type ProductImage = {
  url: string;
  w?: number;
  h?: number;
  /** Optionele alt-tekst per foto (bv. "zijaanzicht"); leeg → productnaam. */
  alt?: string;
};

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
      return [{ url, ...(w ? { w } : {}), ...(h ? { h } : {}), ...(alt ? { alt } : {}) }];
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
