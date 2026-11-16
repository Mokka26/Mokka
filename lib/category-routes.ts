/**
 * Lichte kern van de categorieconfig: route-slugs, weergavenamen en de
 * URL-helpers. Zonder teksten (intro, seoIntro, FAQ, meta-descriptions), zodat
 * client-componenten (winkelwagen, PDP, analytics) niet de hele
 * categorieconfig in hun bundel krijgen.
 *
 * lib/categories.ts is de volledige bron van waarheid en re-exporteert alles
 * hieronder; server-code kan gewoon uit lib/categories blijven importeren.
 * Een categorie toevoegen = hier slug + label, en in lib/categories de rest.
 */

/** Weergavenaam per route-slug (navigatie, koppen, analytics item_category). */
export const CATEGORY_LABELS = {
  banken: "Alle banken", // umbrella: hoekbanken + bankstellen
  hoekbanken: "Hoekbanken",
  bankstellen: "Bankstellen",
  fauteuils: "Fauteuils",
  poefs: "Poefs",
  tafels: "Tafels",
  eettafels: "Eettafels",
  salontafels: "Salontafels",
  bijzettafels: "Bijzettafels",
  "tv-meubels": "TV-meubels",
  stoelen: "Stoelen", // umbrella: eetkamerstoelen + fauteuils
  eetkamerstoelen: "Eetkamerstoelen",
  bedden: "Bedden",
  matrassen: "Matrassen",
  slaapkamers: "Slaapkamers",
  jeugdkamers: "Jeugdkamers",
  kasten: "Alle kasten", // umbrella: kledingkasten + dressoirs + nachtkastjes + ladekasten + kapstokken
  kledingkasten: "Kledingkasten",
  dressoirs: "Dressoirs",
  nachtkastjes: "Nachtkastjes",
  ladekasten: "Ladekasten en commodes",
  kapstokken: "Kapstokken",
  schoenenkasten: "Schoenenkasten",
  verlichting: "Alle verlichting", // umbrella: plafondlampen + vloerlampen + tafellampen + wandlampen
  plafondlampen: "Plafondlampen",
  vloerlampen: "Vloerlampen",
  tafellampen: "Tafellampen",
  wandlampen: "Wandlampen",
  spiegels: "Spiegels",
} as const satisfies Record<string, string>;

export type CategorySlug = keyof typeof CATEGORY_LABELS;

const VALID_SLUGS = new Set<string>(Object.keys(CATEGORY_LABELS));

export function isCategorySlug(slug: string): slug is CategorySlug {
  return VALID_SLUGS.has(slug);
}

/** Weergavenaam van een categorie, of de slug zelf als die onbekend is. */
export function categoryLabelOf(slug: string): string {
  return isCategorySlug(slug) ? CATEGORY_LABELS[slug] : slug;
}

/**
 * Geeft de canonieke route-slug voor een DB-product categorie, of `null` als
 * er geen route voor bestaat. Voorbeeld: db.category="hoekbanken" → "hoekbanken".
 * Nooit stilzwijgend terugvallen op een andere categorie: dat gaf een
 * redirect-lus op de productpagina.
 */
export function dbCategoryToRouteSlug(dbCategory: string): CategorySlug | null {
  return isCategorySlug(dbCategory) ? dbCategory : null;
}

/**
 * Bouwt de canonieke product-URL: /<categorie>/<slug>. Zonder bekende
 * categorie valt de link terug op de legacy-route /products/<slug>, die dan
 * een 404 geeft in plaats van naar een verkeerde categorie te sturen.
 */
export function productUrl(product: { category: string; slug: string }): string {
  const route = dbCategoryToRouteSlug(product.category);
  return route ? `/${route}/${product.slug}` : `/products/${product.slug}`;
}

/**
 * Bouwt categorie-URL: /<categorie>
 */
export function categoryUrl(slug: CategorySlug): string {
  return `/${slug}`;
}
