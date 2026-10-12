import type { CategorySlug } from "@/lib/categories";

/**
 * Registry van de woongidsen: één bron voor het overzicht (/gids), de
 * Article-schema's, de breadcrumbs en de sitemap. Teksten van de gidsen zelf
 * staan in de route-bestanden.
 */
export type Guide = {
  slug: string;
  /** H1 en kaarttitel. */
  title: string;
  /** Meta-title zonder " | Mokka Home" (template in root-layout). */
  metaTitle: string;
  /** Meta-description, 140-160 tekens. */
  description: string;
  /** Korte samenvatting voor de kaart op /gids. */
  teaser: string;
  /** Categorieën waar de gids naartoe verwijst (eerste = primaire CTA). */
  categories: ReadonlyArray<CategorySlug>;
  /** DB-categorieën voor de productsectie onder de gids. */
  productCategories: ReadonlyArray<string>;
  datePublished: string;
  dateModified: string;
};

export const GIDS_PATH = "/gids";

export const GUIDES: ReadonlyArray<Guide> = [
  {
    slug: "eettafel-maat-kiezen",
    title: "Welke maat eettafel heb je nodig?",
    metaTitle: "Eettafel kiezen: de juiste maat per persoon",
    description:
      "Reken 60 cm per zitplaats en 70 tot 80 cm loopruimte rond de tafel. Tabel van personen naar tafellengte, rond of rechthoekig en wanneer uitschuifbaar handig is.",
    teaser: "Hoeveel ruimte per persoon, welke lengte bij vier, zes of acht stoelen, en rond of rechthoekig.",
    categories: ["eettafels", "eetkamerstoelen"],
    productCategories: ["eettafels"],
    datePublished: "2026-10-12",
    dateModified: "2026-10-12",
  },
  {
    slug: "hoekbank-kiezen",
    title: "Een hoekbank kiezen: vorm, maat en richting",
    metaTitle: "Hoekbank kiezen: vorm, maat en links of rechts",
    description:
      "L- of U-vorm, links of rechts bepalen vanaf de voorkant, de maat afstemmen op je kamer en stof of leer in onderhoud. Met vuistregels voor loopruimte.",
    teaser: "L- of U-vorm, links of rechts bepalen, maten ten opzichte van de kamer en stof of leer.",
    categories: ["hoekbanken", "bankstellen"],
    productCategories: ["hoekbanken"],
    datePublished: "2026-10-12",
    dateModified: "2026-10-12",
  },
  {
    slug: "bed-en-matras-kiezen",
    title: "Bed en matras kiezen: maten en keuzes",
    metaTitle: "Bed en matras kiezen: maten en bedlengte",
    description:
      "Matrasmaten van 90 x 200 tot 180 x 200 cm, bedlengte als lichaamslengte plus 20 cm, boxspring of bedframe en hoeveel ruimte nachtkastjes vragen. Met tabel.",
    teaser: "Matrasmaten, de juiste bedlengte, boxspring of bedframe en ruimte voor nachtkastjes.",
    categories: ["bedden", "matrassen"],
    productCategories: ["bedden"],
    datePublished: "2026-10-12",
    dateModified: "2026-10-12",
  },
  {
    slug: "salontafel-afmetingen",
    title: "Salontafel afmetingen: hoogte, lengte en afstand",
    metaTitle: "Salontafel afmetingen: hoogte, lengte, afstand",
    description:
      "Vuistregels salontafel: bladhoogte rond de zithoogte van de bank, 40 tot 45 cm afstand tot de bank, lengte twee derde van de bank, rond bij weinig ruimte.",
    teaser: "Hoe hoog, hoe lang en hoe ver van de bank, en wanneer een ronde tafel beter werkt.",
    categories: ["salontafels", "bijzettafels"],
    productCategories: ["salontafels"],
    datePublished: "2026-10-12",
    dateModified: "2026-10-12",
  },
];

export function guidePath(slug: string): string {
  return `${GIDS_PATH}/${slug}`;
}

export function getGuide(slug: string): Guide {
  const guide = GUIDES.find((g) => g.slug === slug);
  if (!guide) throw new Error(`Onbekende gids: ${slug}`);
  return guide;
}
