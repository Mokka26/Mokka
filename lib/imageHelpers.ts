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
};

export function parseImages(raw: string | null | undefined): ProductImage[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((item): ProductImage[] => {
      if (typeof item === "string" && item.length > 0) return [{ url: item }];
      if (item && typeof item === "object" && typeof item.url === "string") {
        return [
          {
            url: item.url,
            w: typeof item.w === "number" && item.w > 0 ? item.w : undefined,
            h: typeof item.h === "number" && item.h > 0 ? item.h : undefined,
          },
        ];
      }
      return [];
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
 * Aspect ratio voor CSS aspect-ratio property. Default 1 als dims onbekend.
 */
export function imageAspect(img: ProductImage | undefined, fallback = 1): number {
  if (!img || !img.w || !img.h) return fallback;
  return img.w / img.h;
}
