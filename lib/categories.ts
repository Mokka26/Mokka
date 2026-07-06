/**
 * Bron van waarheid voor alle product-categorieën.
 *
 * Wordt gebruikt voor:
 *  - Route-validatie (`app/[category]/page.tsx`)
 *  - Sitemap generatie
 *  - FilterBar groepering
 *  - ProductsContent labels + intros
 *  - JSON-LD CollectionPage schema
 *
 * Pseudo-categorieën (zoals "banken" = umbrella) zijn expliciet
 * gemarkeerd; ze hebben geen 1-op-1 mapping naar Product.category in DB.
 */

export type CategorySlug =
  | "banken"           // umbrella: hoekbanken + bankstellen
  | "hoekbanken"
  | "bankstellen"
  | "fauteuils"
  | "bedden"
  | "matrassen"
  | "slaapkamers"
  | "jeugdkamers"
  | "kasten"           // umbrella: kledingkasten + dressoirs + nachtkastjes + ladekasten + kapstokken
  | "kledingkasten"
  | "dressoirs"
  | "nachtkastjes"
  | "ladekasten"
  | "kapstokken"
  | "schoenenkasten"
  | "tafels"
  | "eettafels"
  | "salontafels"
  | "bijzettafels"
  | "tv-meubels"
  | "tafel-accessoires"
  | "stoelen"           // umbrella: eetkamerstoelen + fauteuils
  | "eetkamerstoelen"
  | "poefs"
  | "spiegels"
  | "verlichting"      // umbrella: plafondlampen + vloerlampen + tafellampen + wandlampen
  | "plafondlampen"
  | "vloerlampen"
  | "tafellampen"
  | "wandlampen";

export type Category = {
  slug: CategorySlug;
  label: string;
  intro: string;
  /**
   * DB-mapping: welke `Product.category` waardes vallen onder deze slug.
   * Umbrella's mappen naar meerdere DB-categorieën.
   */
  dbCategories: ReadonlyArray<string>;
  /** True voor umbrella's die meerdere DB-categorieën combineren */
  isUmbrella: boolean;
  /** Hoort tot welke top-groep in FilterBar */
  group: "Banken" | "Tafels" | "Stoelen" | "Slapen" | "Opbergen" | "Sfeer";
  /**
   * Optioneel: gewenste display-volgorde van DB-sub-categorieën op een
   * umbrella-pagina. Producten van een hier genoemde categorie komen eerst,
   * in deze volgorde; niet-genoemde categorieën volgen daarna (in hun
   * featured/nieuwste-volgorde). Bv. banken → hoekbanken vóór bankstellen.
   */
  typeOrder?: ReadonlyArray<string>;
  /**
   * Optioneel: korte regel onder de productnaam op de kaart + PDP. Bv.
   * banken → "In diverse uitvoeringen en kleuren.". Per categorie gezet
   * zodat de tekst op één plek staat (geen hardcode in componenten).
   */
  cardSubtitle?: string;
};

export const CATEGORIES: ReadonlyArray<Category> = [
  // ─── Banken ──────────────────────────────────────────────────
  {
    slug: "banken",
    label: "Alle banken",
    intro: "De volledige bank-collectie — hoekbanken en bankstellen samen op één plek.",
    dbCategories: ["banken", "hoekbanken", "bankstellen"],
    isUmbrella: true,
    group: "Banken",
    typeOrder: ["hoekbanken", "bankstellen"],
    cardSubtitle: "In diverse uitvoeringen en kleuren.",
  },
  {
    slug: "hoekbanken",
    label: "Hoekbanken",
    intro: "De volledige collectie — single sofa's, L- en U-vorm modellen, lounge-banken.",
    dbCategories: ["hoekbanken"],
    isUmbrella: false,
    group: "Banken",
    cardSubtitle: "In diverse uitvoeringen en kleuren.",
  },
  {
    slug: "bankstellen",
    label: "Bankstellen",
    intro: "Complete zit-sets in 3+2+1 of 3+2 configuratie. Eenheid in materiaal en lijn.",
    dbCategories: ["bankstellen"],
    isUmbrella: false,
    group: "Banken",
    cardSubtitle: "In diverse uitvoeringen en kleuren.",
  },
  {
    slug: "fauteuils",
    label: "Fauteuils",
    intro: "Losse fauteuils en armstoelen — een comfortabele zit naast de bank of als accent.",
    dbCategories: ["fauteuils"],
    isUmbrella: false,
    group: "Stoelen",
    cardSubtitle: "In diverse kleuren.",
  },
  {
    slug: "poefs",
    label: "Poefs",
    intro: "Poefs en zithockers — een zachte extra zit of voetensteun, in diverse kleuren en stoffen.",
    dbCategories: ["poefs"],
    isUmbrella: false,
    group: "Stoelen",
    cardSubtitle: "In diverse kleuren.",
  },

  // ─── Tafels ──────────────────────────────────────────────────
  {
    slug: "tafels",
    label: "Tafels",
    intro: "Om de tafel wordt geleefd. Eettafels, salontafels en bijzettafels — filter op type.",
    dbCategories: ["tafels", "eettafels", "salontafels", "bijzettafels", "tafel-accessoires"],
    isUmbrella: true,
    group: "Tafels",
  },
  {
    slug: "eettafels",
    label: "Eettafels",
    intro: "De plek waar dagen beginnen en eindigen. Eettafels in eik, marmer en steen.",
    dbCategories: ["eettafels"],
    isUmbrella: false,
    group: "Tafels",
  },
  {
    slug: "salontafels",
    label: "Salontafels",
    intro: "Het middelpunt van de woonkamer — sculpturaal en functioneel.",
    dbCategories: ["salontafels"],
    isUmbrella: false,
    group: "Tafels",
  },
  {
    slug: "bijzettafels",
    label: "Bijzettafels",
    intro: "Klein maar betekenisvol. Accentstukken voor naast de bank of bij het bed.",
    dbCategories: ["bijzettafels"],
    isUmbrella: false,
    group: "Tafels",
  },
  {
    slug: "tv-meubels",
    label: "TV-meubels",
    intro: "Strakke lijnen voor het hart van je entertainmentruimte.",
    dbCategories: ["tv-meubels"],
    isUmbrella: false,
    group: "Tafels",
  },
  {
    slug: "tafel-accessoires",
    label: "Tafel-accessoires",
    intro: "Losse tafelbladen en onderdelen — marmer, sinter stone, glas.",
    dbCategories: ["tafel-accessoires"],
    isUmbrella: false,
    group: "Tafels",
  },

  // ─── Stoelen ─────────────────────────────────────────────────
  {
    slug: "stoelen",
    label: "Stoelen",
    intro: "Sculpturaal comfort — eetkamerstoelen en fauteuils. Filter op type.",
    dbCategories: ["stoelen", "eetkamerstoelen", "fauteuils"],
    isUmbrella: true,
    group: "Stoelen",
    cardSubtitle: "In diverse kleuren.",
  },
  {
    slug: "eetkamerstoelen",
    label: "Eetkamerstoelen",
    intro: "De stoel waar je aan tafel op zit — comfortabel, stevig en mooi van lijn.",
    dbCategories: ["eetkamerstoelen"],
    isUmbrella: false,
    group: "Stoelen",
    cardSubtitle: "In diverse kleuren.",
  },

  // ─── Slapen ──────────────────────────────────────────────────
  {
    slug: "bedden",
    label: "Bedden",
    intro: "Slapen als ritueel. Boxsprings en bedframes voor diepe rust en stille ochtenden.",
    dbCategories: ["bedden"],
    isUmbrella: false,
    group: "Slapen",
    cardSubtitle: "In diverse maten.",
  },
  {
    slug: "matrassen",
    label: "Matrassen",
    intro: "Pocketveer en koudschuim — de basis van elke goede nachtrust.",
    dbCategories: ["matrassen"],
    isUmbrella: false,
    group: "Slapen",
  },
  {
    slug: "slaapkamers",
    label: "Slaapkamers",
    intro: "Rust begint hier. Zachte materialen en warme tinten voor de persoonlijkste ruimte.",
    dbCategories: ["slaapkamers"],
    isUmbrella: false,
    group: "Slapen",
  },
  {
    slug: "jeugdkamers",
    label: "Jeugdkamers",
    intro: "Complete kamers voor kinderen en tieners — bed, kast en bureau in één stijl.",
    dbCategories: ["jeugdkamers"],
    isUmbrella: false,
    group: "Slapen",
  },

  // ─── Opbergen ────────────────────────────────────────────────
  {
    slug: "kasten",
    label: "Alle kasten",
    intro: "Meer dan opbergruimte — kasten als architectuur die je interieur structureren.",
    dbCategories: ["kasten", "kledingkasten", "dressoirs", "nachtkastjes", "ladekasten", "kapstokken", "schoenenkasten"],
    isUmbrella: true,
    group: "Opbergen",
  },
  {
    slug: "kledingkasten",
    label: "Kledingkasten",
    intro: "Ruime garderobekasten met schuif- of draaideuren — orde in de slaapkamer.",
    dbCategories: ["kledingkasten"],
    isUmbrella: false,
    group: "Opbergen",
  },
  {
    slug: "dressoirs",
    label: "Dressoirs",
    intro: "Lage opbergkasten voor de woon- of eetkamer — opbergruimte met allure.",
    dbCategories: ["dressoirs"],
    isUmbrella: false,
    group: "Opbergen",
  },
  {
    slug: "nachtkastjes",
    label: "Nachtkastjes",
    intro: "Het kleine meubel naast je bed — voor wat altijd binnen handbereik moet zijn.",
    dbCategories: ["nachtkastjes"],
    isUmbrella: false,
    group: "Opbergen",
  },
  {
    slug: "ladekasten",
    label: "Ladekasten & Commodes",
    intro: "Lades vol opbergruimte — commodes en ladekasten voor slaapkamer en hal.",
    dbCategories: ["ladekasten"],
    isUmbrella: false,
    group: "Opbergen",
  },
  {
    slug: "kapstokken",
    label: "Kapstokken",
    intro: "Een warm welkom in de hal — kapstokken en garderobe-oplossingen.",
    dbCategories: ["kapstokken"],
    isUmbrella: false,
    group: "Opbergen",
  },
  {
    slug: "schoenenkasten",
    label: "Schoenenkasten",
    intro: "Schoenen netjes uit het zicht — slanke kasten en lades voor in de hal.",
    dbCategories: ["schoenenkasten"],
    isUmbrella: false,
    group: "Opbergen",
  },

  // ─── Sfeer ───────────────────────────────────────────────────
  {
    slug: "verlichting",
    label: "Alle verlichting",
    intro: "Sfeer maken begint bij licht. Plafond-, vloer-, tafel- en wandlampen met karakter.",
    dbCategories: ["verlichting", "plafondlampen", "vloerlampen", "tafellampen", "wandlampen"],
    isUmbrella: true,
    group: "Sfeer",
  },
  {
    slug: "plafondlampen",
    label: "Plafondlampen",
    intro: "Het licht van bovenaf — hang- en plafondlampen die de ruimte definiëren.",
    dbCategories: ["plafondlampen"],
    isUmbrella: false,
    group: "Sfeer",
  },
  {
    slug: "vloerlampen",
    label: "Vloerlampen",
    intro: "Staand licht voor een leeshoek of als sculpturaal accent naast de bank.",
    dbCategories: ["vloerlampen"],
    isUmbrella: false,
    group: "Sfeer",
  },
  {
    slug: "tafellampen",
    label: "Tafellampen",
    intro: "Warm licht op ooghoogte — voor op het dressoir, bureau of nachtkastje.",
    dbCategories: ["tafellampen"],
    isUmbrella: false,
    group: "Sfeer",
  },
  {
    slug: "wandlampen",
    label: "Wandlampen",
    intro: "Subtiel licht aan de muur — wandlampen en appliques voor sfeer en accent.",
    dbCategories: ["wandlampen"],
    isUmbrella: false,
    group: "Sfeer",
  },
  {
    slug: "spiegels",
    label: "Spiegels",
    intro: "Wandsculpturen die ruimte verdiepen en licht vermenigvuldigen.",
    dbCategories: ["spiegels"],
    isUmbrella: false,
    group: "Sfeer",
  },
] as const;

// ─── Lookup helpers ─────────────────────────────────────────────────

const VALID_SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));

export function isCategorySlug(slug: string): slug is CategorySlug {
  return VALID_SLUGS.has(slug);
}

export function getCategory(slug: string): Category | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/**
 * Geeft de canonieke route-slug voor een DB-product categorie.
 * Voorbeeld: db.category="hoekbanken" → "hoekbanken"
 * Wordt gebruikt in ProductCard om `/<category>/<slug>` te bouwen.
 */
export function dbCategoryToRouteSlug(dbCategory: string): CategorySlug {
  // Direct match: dbCategory is een geldige slug
  if (isCategorySlug(dbCategory)) return dbCategory;
  // Fallback (mocht een product een DB-category hebben die geen route heeft)
  return "banken";
}

/**
 * Bouwt de canonieke product-URL: /<categorie>/<slug>
 */
export function productUrl(product: { category: string; slug: string }): string {
  return `/${dbCategoryToRouteSlug(product.category)}/${product.slug}`;
}

/**
 * Bouwt categorie-URL: /<categorie>
 */
export function categoryUrl(slug: CategorySlug): string {
  return `/${slug}`;
}

/**
 * Groepering voor FilterBar (geprefereerde display-volgorde per groep).
 */
export const GROUP_ORDER: ReadonlyArray<Category["group"]> = [
  "Banken",
  "Tafels",
  "Stoelen",
  "Slapen",
  "Opbergen",
  "Sfeer",
] as const;
