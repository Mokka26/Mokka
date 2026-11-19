// Tijdelijke acties. Eén bron voor wat de actie is, voor wie en tot wanneer;
// PDP, winkelwagen, checkout en order lezen dit hier. Na de einddatum valt
// alles vanzelf weg (geen deploy nodig om de actie te stoppen).

export type GiftOffer = {
  /** Korte naam, ook op de orderregel ("+ gratis …"). */
  name: string;
  /** Inhoud van de set, in leesvolgorde. */
  contents: ReadonlyArray<string>;
  /** Laatste actiedag, voor in de tekst. */
  untilLabel: string;
  image: { src: string; alt: string; width: number; height: number };
};

/** Black Friday 2026: gratis Bambi Mogy Soft slaapset bij elk Bambi-bed. */
export const BAMBI_SLEEP_SET: GiftOffer = {
  name: "Bambi Mogy Soft slaapset",
  contents: ["Dekbed", "2 hoofdkussens", "2 kussenslopen", "Matrasbeschermer"],
  untilLabel: "30 november",
  image: {
    src: "/campaign/bambi-mogy-soft-slaapset.jpg",
    alt: "Bambi Mogy Soft slaapset: opgerold dekbed, hoofdkussen en matrasbeschermer op de verpakking",
    width: 960,
    height: 1440,
  },
};

/** Einde van de actie: 1 december 2026 00:00 Nederlandse tijd. */
export const BAMBI_GIFT_ENDS_AT = Date.parse("2026-12-01T00:00:00+01:00");

// Product.source (interne leverancierstag) in kleine letters. Alleen Bambi,
// niet de overige BSS-bedden.
const BAMBI_SOURCES = new Set(["bambi", "bss bambi"]);
const GIFT_CATEGORIES = new Set(["bedden"]);

export function isGiftActive(now: number = Date.now()): boolean {
  return now < BAMBI_GIFT_ENDS_AT;
}

/** Het actiecadeau bij dit product, of null. Alleen server-side aanroepen (source is intern). */
export function giftFor(product: { source: string | null; category: string }, now: number = Date.now()): GiftOffer | null {
  if (!isGiftActive(now)) return null;
  if (!GIFT_CATEGORIES.has(product.category)) return null;
  const source = (product.source ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return BAMBI_SOURCES.has(source) ? BAMBI_SLEEP_SET : null;
}

/** Tekst voor de orderregel en de winkelwagen. */
export function giftLineLabel(giftName: string): string {
  return `+ gratis ${giftName}`;
}
