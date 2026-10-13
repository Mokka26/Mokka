/**
 * SEO-helpers voor route-metadata: gedeelde Open Graph-defaults, de
 * categorie-titles/-descriptions (patroon + lengtebewaking) en de
 * publicatiedata van statische routes voor de sitemap.
 *
 * Open Graph: Next vervangt bij een route met een eigen `openGraph` het hele
 * object van de root-layout (geen diepe merge). De file-based
 * `app/opengraph-image.tsx` komt dan niet meer mee. `ogDefaults()` zet daarom
 * altijd `images` én `siteName`/`locale`, zodat elke pagina een OG-beeld houdt.
 */
import type { Metadata } from "next";
import { businessInfo } from "@/lib/business-info";
import { truncateAtWord } from "@/lib/jsonLd";
import type { Category } from "@/lib/categories";

// ─── Open Graph ─────────────────────────────────────────────────────

/** Root-OG-beeld (app/opengraph-image.tsx, 1200×630). */
export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: businessInfo.name,
} as const;

type OgInput = {
  title: string;
  description: string;
  /** Relatief pad ("/bezorging"); `metadataBase` maakt het absoluut. */
  url: string;
  type?: "website" | "article";
  /** Eigen beeld (bv. productfoto); anders het root-OG-beeld. */
  image?: { url: string; width?: number; height?: number; alt?: string } | null;
  publishedTime?: string;
  modifiedTime?: string;
};

/** `openGraph` + `twitter` voor een route; vul `title` al inclusief merknaam. */
export function ogDefaults(input: OgInput): Pick<Metadata, "openGraph" | "twitter"> {
  const image = input.image ?? DEFAULT_OG_IMAGE;
  const openGraph: NonNullable<Metadata["openGraph"]> = {
    siteName: businessInfo.name,
    title: input.title,
    description: input.description,
    type: input.type ?? "website",
    url: input.url,
    locale: "nl_NL",
    images: [image],
    ...(input.type === "article" && input.publishedTime
      ? { publishedTime: input.publishedTime, modifiedTime: input.modifiedTime ?? input.publishedTime }
      : {}),
  };
  return {
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image.url],
    },
  };
}

// ─── Categorie-metadata ─────────────────────────────────────────────

/** Totaal 50-60 tekens incl. " | Mokka Home" (template in de root-layout). */
const TITLE_MAX = 60;
const BRAND_SUFFIX = ` | ${businessInfo.name}`;
const TITLE_ROOM = TITLE_MAX - BRAND_SUFFIX.length;
const DESCRIPTION_MAX = 160;
const DEFAULT_TITLE_SUFFIX = "maten, kleuren en levertijd";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Eerste kandidaat die binnen de titelruimte past; de laatste is de fallback. */
function fitTitle(candidates: ReadonlyArray<string>): string {
  return candidates.find((c) => c.length <= TITLE_ROOM) ?? candidates[candidates.length - 1];
}

/**
 * "<Naam> kopen: maten, kleuren en levertijd" (zonder merknaam; de layout
 * voegt " | Mokka Home" toe). Bij ruimtegebrek vervalt eerst "kleuren", dan
 * de hele toevoeging. Pagina ≥ 2 krijgt ", pagina N".
 */
export function categoryTitle(category: Category, page = 1): string {
  // Label behouden als die alleen in hoofdletters verschilt ("TV-meubels").
  const name = category.label.toLowerCase() === category.name ? category.label : cap(category.name);
  const suffix = category.titleSuffix ?? DEFAULT_TITLE_SUFFIX;
  if (page > 1) {
    return fitTitle([
      `${name} kopen: maten en levertijd, pagina ${page}`,
      `${name} kopen, pagina ${page}`,
    ]);
  }
  return fitTitle([`${name} kopen: ${suffix}`, `${name} kopen: maten en levertijd`, `${name} kopen`]);
}

/** Meta-description uit lib/categories.ts; pagina ≥ 2 met "Pagina N:" ervoor, max. 160 tekens. */
export function categoryDescription(category: Category, page = 1): string {
  if (page <= 1) return category.metaDescription;
  return truncateAtWord(`Pagina ${page}: ${category.metaDescription}`, DESCRIPTION_MAX);
}

// ─── Sitemap: publicatiedatum per statische route ───────────────────

/**
 * Datum van de laatste inhoudelijke wijziging per statische route
 * (YYYY-MM-DD). Bijwerken als de tekst van die pagina verandert; de gidsen
 * hebben hun eigen `dateModified` in app/gids/guides.ts.
 */
export const STATIC_ROUTE_UPDATED: Readonly<Record<string, string>> = {
  "/": "2026-10-12",
  "/about": "2026-10-12",
  "/contact": "2026-10-12",
  "/retourneren": "2026-10-12",
  "/privacy": "2026-10-12",
  "/algemene-voorwaarden": "2026-10-12",
  "/cookies": "2026-10-12",
  "/bezorging": "2026-10-12",
  "/betalen": "2026-10-12",
  "/showroom": "2026-10-12",
  "/gids": "2026-10-12",
};
