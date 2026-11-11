import { isCategorySlug } from "@/lib/categories";

/** Interne prefix van de ISR-categorievariant (zie app/categorie-cache). */
export const CATEGORY_CACHE_PREFIX = "/categorie-cache/";

/**
 * Kale categorie-URL (/eettafels, zonder filters/sortering/pagina) → slug,
 * anders null. `_rsc` is Next's eigen cache-buster bij client-navigatie en
 * telt niet als query. Alleen deze URL's kunnen uit de CDN-cache komen.
 */
export function cacheableCategory(pathname: string, searchParams: URLSearchParams): string | null {
  const m = pathname.match(/^\/([a-z0-9-]+)\/?$/);
  if (!m || !isCategorySlug(m[1])) return null;
  for (const key of searchParams.keys()) if (key !== "_rsc") return null;
  return m[1];
}
