import { CATEGORIES } from "@/lib/categories";

/**
 * Geldige waarden voor `Product.category` in de database: alle
 * `dbCategories` van niet-umbrella categorieën plus hun eigen slug.
 * Umbrella's ("banken", "tafels", …) zijn alleen routes, geen DB-categorie.
 */
const set = new Set<string>();
for (const c of CATEGORIES) {
  if (c.isUmbrella) continue;
  set.add(c.slug);
  for (const db of c.dbCategories) set.add(db);
}

export const VALID_DB_CATEGORIES = [...set].sort() as [string, ...string[]];

export function isValidDbCategory(value: string): boolean {
  return set.has(value);
}
