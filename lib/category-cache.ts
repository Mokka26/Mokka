import { isCategorySlug } from "@/lib/category-routes";

/** Interne prefix van de ISR-categorievariant (zie app/categorie-cache). */
export const CATEGORY_CACHE_PREFIX = "/categorie-cache/";

/**
 * Lijstpagina's naast de categorieën die ook een ISR-variant hebben onder
 * app/categorie-cache/<pad> (statisch segment, wint van [category]).
 */
const CACHEABLE_LISTINGS: ReadonlySet<string> = new Set(["aanbiedingen"]);

/**
 * Kale categorie-URL (/eettafels, zonder filters/sortering/pagina) → slug,
 * anders null. Ook /aanbiedingen (zie CACHEABLE_LISTINGS). `_rsc` is Next's
 * eigen cache-buster bij client-navigatie en telt niet als query. Alleen deze
 * URL's kunnen uit de CDN-cache komen.
 */
export function cacheableCategory(pathname: string, searchParams: URLSearchParams): string | null {
  const m = pathname.match(/^\/([a-z0-9-]+)\/?$/);
  if (!m || !(isCategorySlug(m[1]) || CACHEABLE_LISTINGS.has(m[1]))) return null;
  for (const key of searchParams.keys()) if (key !== "_rsc") return null;
  return m[1];
}
