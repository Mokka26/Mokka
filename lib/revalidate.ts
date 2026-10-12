import { revalidatePath, revalidateTag } from "next/cache";
import { CATEGORIES, dbCategoryToRouteSlug } from "@/lib/categories";

/**
 * Cache-tag voor alles wat uit de producttabel komt (lijsten, tellingen,
 * sitemap, feed). Gebruik `unstable_cache(fn, keys, { tags: [PRODUCTS_TAG] })`
 * bij het ophalen, en `revalidateProduct()` bij elke mutatie.
 */
export const PRODUCTS_TAG = "products";

type ProductRef = { slug: string; category: string };

const GLOBAL_PATHS = ["/", "/products", "/sitemap.xml", "/feed/google-shopping.xml", "/admin", "/admin/products"];

/** Alle route-slugs (incl. umbrella's) waar een DB-categorie onder valt. */
function routesForCategory(dbCategory: string): string[] {
  const routes = new Set<string>();
  const direct = dbCategoryToRouteSlug(dbCategory);
  if (direct) routes.add(direct);
  for (const c of CATEGORIES) {
    if (c.dbCategories.includes(dbCategory)) routes.add(c.slug);
  }
  return [...routes];
}

/**
 * Ververst elke publieke pagina waar een product op kan staan: de PDP, de
 * categorie- en umbrella-pagina's, de homepage, het totaaloverzicht, de
 * sitemap en de Shopping-feed. Geef `previous` mee bij een slug- of
 * categoriewijziging zodat ook de oude paden vervallen.
 */
export function revalidateProduct(product: ProductRef, previous?: Partial<ProductRef>): void {
  const refs: ProductRef[] = [product];
  if (previous?.slug || previous?.category) {
    refs.push({ slug: previous.slug ?? product.slug, category: previous.category ?? product.category });
  }
  const paths = new Set<string>(GLOBAL_PATHS);
  for (const ref of refs) {
    for (const route of routesForCategory(ref.category)) {
      paths.add(`/${route}`);
      paths.add(`/${route}/${ref.slug}`);
    }
    // Legacy-route (301 naar de canonieke PDP) en admin-pagina's.
    paths.add(`/products/${ref.slug}`);
    paths.add(`/admin/preview/${ref.slug}`);
    paths.add(`/admin/products/${ref.slug}`);
  }
  for (const p of paths) revalidatePath(p);
  revalidateTag(PRODUCTS_TAG, "max");
}

/** Voor bulkmutaties: alles wat producten toont in één keer verversen. */
export function revalidateAllProducts(): void {
  const paths = new Set<string>(GLOBAL_PATHS);
  for (const c of CATEGORIES) paths.add(`/${c.slug}`);
  for (const p of paths) revalidatePath(p);
  revalidatePath("/[category]/[slug]", "page");
  revalidateTag(PRODUCTS_TAG, "max");
}
