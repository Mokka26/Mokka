import { businessInfo, getActiveSocials } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { parseImages } from "@/lib/imageHelpers";

/**
 * Serialiseer een JSON-LD object veilig voor inline <script type="application/ld+json">.
 *
 * Escapet `<` naar `<` zodat een productnaam/-beschrijving met een
 * `</script>`-sequentie niet uit het script-blok kan breken (XSS-hardening).
 * Gebruik altijd dit i.p.v. kale JSON.stringify in dangerouslySetInnerHTML.
 */
export function jsonLdHtml(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

// ─── SEO-teksthelpers ───────────────────────────────────────────────

/** Witruimte samenvouwen (beschrijvingen uit de DB bevatten vaak newlines). */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Kapt een tekst af op een woordgrens, nooit midden in een woord. Laat een
 * eventueel afsluitend leesteken staan en voegt geen "…" toe (zoekmachines
 * tonen dat zelf).
 */
export function truncateAtWord(text: string, max: number): string {
  const clean = collapseWhitespace(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 0 ? cut.slice(0, lastSpace) : clean.slice(0, max);
  return base.replace(/[\s,;:–—-]+$/u, "");
}

const TITLE_MAX = 60;
const DESCRIPTION_MIN = 140;
const DESCRIPTION_MAX = 160;

/**
 * Productpagina-title: "<naam> | <categorie> | Mokka Home", maximaal 60
 * tekens. Bij ruimtegebrek vervalt eerst de categorie, daarna wordt de
 * productnaam op een woordgrens ingekort. De bedrijfsnaam blijft altijd staan.
 */
export function buildProductTitle(productName: string, categoryLabel: string | null): string {
  const brand = businessInfo.name;
  const name = collapseWhitespace(productName);
  const withCategory = categoryLabel ? `${name} | ${categoryLabel} | ${brand}` : null;
  if (withCategory && withCategory.length <= TITLE_MAX) return withCategory;
  const withoutCategory = `${name} | ${brand}`;
  if (withoutCategory.length <= TITLE_MAX) return withoutCategory;
  const room = TITLE_MAX - ` | ${brand}`.length;
  return `${truncateAtWord(name, room)} | ${brand}`;
}

/**
 * Meta-description van 140-160 tekens op een woordgrens. Is de bron te kort,
 * dan wordt er een feitelijke zin over categorie en bedrijf achter gezet.
 */
export function buildDescription(source: string, fallbackSentence: string): string {
  let text = collapseWhitespace(source);
  if (text.length < DESCRIPTION_MIN) {
    const sep = text && !/[.!?]$/.test(text) ? ". " : text ? " " : "";
    text = `${text}${sep}${fallbackSentence}`;
  }
  return truncateAtWord(text, DESCRIPTION_MAX);
}

export function buildProductDescription(
  productDescription: string,
  productName: string,
  categoryLabel: string | null,
): string {
  const fallback = categoryLabel
    ? `${productName} bestel je bij ${businessInfo.name}, alle prijzen incl. btw en ${shippingInfo.returnWindowDays} dagen bedenktijd. Bekijk meer ${categoryLabel.toLowerCase()} in onze showroom in ${businessInfo.address.city} of online.`
    : `${productName} bestel je bij ${businessInfo.name}, alle prijzen incl. btw en ${shippingInfo.returnWindowDays} dagen bedenktijd. Bekijk de collectie in onze showroom in ${businessInfo.address.city} of online.`;
  return buildDescription(productDescription, fallback);
}

// ─── Specs-helpers ──────────────────────────────────────────────────

function parseSpecs(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

type SizeVariant = { label: string; price: number };

function parseSizeVariants(raw: string | null | undefined): SizeVariant[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((v): SizeVariant[] => {
      if (!v || typeof v !== "object") return [];
      const { label, price } = v as Record<string, unknown>;
      if (typeof label !== "string" || typeof price !== "number" || price <= 0) return [];
      return [{ label, price }];
    });
  } catch {
    return [];
  }
}

/** Alleen een echte EAN-13 (13 cijfers) wordt als gtin13 opgenomen. */
function gtin13(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\s/g, "");
  return /^\d{13}$/.test(digits) ? digits : null;
}

/**
 * "2-3 werkdagen", "4 tot 8 weken", "2–4 weken" → transit-tijd in werkdagen.
 * Weken worden omgerekend naar 5 werkdagen. Geen bereik → null (weglaten).
 */
export function parseTransitDays(text: string | null | undefined): { min: number; max: number } | null {
  if (!text) return null;
  const m = text.match(/(\d+)\s*(?:-|–|—|tot)\s*(\d+)\s*(werkdag|dag|we(?:e)?k)/i);
  if (!m) return null;
  // "weken"/"week" → ×5 werkdagen; "werkdagen" begint ook met "we", dus op "week" matchen.
  const factor = /^wee?k/i.test(m[3]) ? 5 : 1;
  const a = Number(m[1]) * factor;
  const b = Number(m[2]) * factor;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

// ─── Product ────────────────────────────────────────────────────────

export type JsonLdProduct = {
  name: string;
  slug: string;
  description: string;
  price: number;
  images: string;
  specs?: string | null;
  sizeVariants?: string | null;
  stock: number;
  deliveryTime?: string | null;
};

const SCHEMA = "https://schema.org";

function quantitative(min: number, max: number) {
  return { "@type": "QuantitativeValue", minValue: min, maxValue: max, unitCode: "DAY" };
}

function buildShippingDetails(price: number, deliveryTime: string | null | undefined, inStock: boolean) {
  const free = price >= shippingInfo.freeShippingThreshold;
  const transit = parseTransitDays(deliveryTime ?? (inStock ? shippingInfo.deliveryTime.inStock : null));
  const deliveryTimeSpec: Record<string, unknown> = {
    "@type": "ShippingDeliveryTime",
    handlingTime: quantitative(1, 3),
  };
  if (transit) deliveryTimeSpec.transitTime = quantitative(transit.min, transit.max);
  return {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: free ? 0 : shippingInfo.rates.standard,
      currency: "EUR",
    },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "NL" },
    deliveryTime: deliveryTimeSpec,
  };
}

function buildReturnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: [...shippingInfo.freeShippingCountries],
    returnPolicyCategory: `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
    merchantReturnDays: shippingInfo.returnWindowDays,
    returnMethod: `${SCHEMA}/ReturnByMail`,
  };
}

/**
 * Product-schema voor de PDP. Zonder `offers` als de prijs 0 of negatief is
 * (prijs nog niet bevestigd); met `AggregateOffer` zodra er maatvarianten
 * met eigen prijs zijn.
 */
export function buildProductJsonLd(product: JsonLdProduct, opts: { url: string }): Record<string, unknown> {
  const specs = parseSpecs(product.specs);
  const images = parseImages(product.images).map((i) => i.url);
  const ean = gtin13(specs.EAN);
  const brandName = specs.Merk ?? (ean ? null : businessInfo.name);

  const schema: Record<string, unknown> = {
    "@context": SCHEMA,
    "@type": "Product",
    name: collapseWhitespace(product.name),
    description: truncateAtWord(product.description, 300),
    sku: specs.Artikelnummer ?? product.slug,
    url: opts.url,
  };
  if (images.length > 0) schema.image = images;
  if (ean) schema.gtin13 = ean;
  if (brandName) schema.brand = { "@type": "Brand", name: brandName };

  if (product.price <= 0) return schema;

  const inStock = product.stock > 0;
  const availability = inStock ? `${SCHEMA}/InStock` : `${SCHEMA}/OutOfStock`;
  const shared = {
    priceCurrency: "EUR",
    availability,
    itemCondition: `${SCHEMA}/NewCondition`,
    url: opts.url,
    seller: { "@type": "Organization", name: businessInfo.legalName },
    hasMerchantReturnPolicy: buildReturnPolicy(),
    shippingDetails: buildShippingDetails(product.price, product.deliveryTime, inStock),
  };

  const variants = parseSizeVariants(product.sizeVariants);
  if (variants.length > 0) {
    const prices = [product.price, ...variants.map((v) => v.price)].filter((p) => p > 0);
    schema.offers = {
      "@type": "AggregateOffer",
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: variants.length,
      ...shared,
    };
    return schema;
  }

  schema.offers = { "@type": "Offer", price: product.price.toFixed(2), ...shared };
  return schema;
}

// ─── Breadcrumb ─────────────────────────────────────────────────────

export type BreadcrumbItem = { name: string; url: string };

/** `url` mag relatief zijn ("/eettafels"); wordt absoluut gemaakt met siteUrl. */
export function buildBreadcrumbJsonLd(items: ReadonlyArray<BreadcrumbItem>): Record<string, unknown> {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${businessInfo.siteUrl}${item.url}`,
    })),
  };
}

// ─── Organisatie + website ──────────────────────────────────────────

const DAY_NAMES: ReadonlyArray<[keyof typeof businessInfo.openingHours, string]> = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
];

function buildOpeningHours(): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const [key, dayOfWeek] of DAY_NAMES) {
    const hours = businessInfo.openingHours[key];
    if (!hours) continue;
    const m = hours.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    if (!m) continue;
    out.push({ "@type": "OpeningHoursSpecification", dayOfWeek, opens: m[1], closes: m[2] });
  }
  return out;
}

export function buildOrganizationJsonLd(): Record<string, unknown> {
  const { legalName, name, address, contact, kvk, btw, foundingYear, siteUrl } = businessInfo;
  const socials = getActiveSocials();

  const schema: Record<string, unknown> = {
    "@context": SCHEMA,
    "@type": ["LocalBusiness", "FurnitureStore"],
    "@id": `${siteUrl}/#organization`,
    url: siteUrl,
    name: legalName,
    alternateName: name,
    description: businessInfo.tagline,
    logo: `${siteUrl}/images/logo.png`,
    image: `${siteUrl}/images/logo.png`,
    foundingDate: String(foundingYear),
    address: {
      "@type": "PostalAddress",
      streetAddress: address.street,
      postalCode: address.postalCode,
      addressLocality: address.city,
      addressCountry: address.country,
    },
    priceRange: "€€",
  };
  if (contact.email) schema.email = contact.email;
  if (contact.phone) schema.telephone = contact.phone;
  if (btw) schema.vatID = btw;
  if (kvk) schema.taxID = kvk;
  const hours = buildOpeningHours();
  if (hours.length > 0) schema.openingHoursSpecification = hours;
  // `geo` bewust weggelaten: lib/business-info.ts heeft (nog) geen
  // coördinaten. Voeg ze daar toe en zet hier GeoCoordinates zodra bevestigd.
  if (socials.length > 0) schema.sameAs = socials.map((s) => s.url);
  return schema;
}

export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": SCHEMA,
    "@type": "WebSite",
    "@id": `${businessInfo.siteUrl}/#website`,
    url: businessInfo.siteUrl,
    name: businessInfo.name,
    alternateName: businessInfo.legalName,
    inLanguage: "nl-NL",
    publisher: { "@id": `${businessInfo.siteUrl}/#organization` },
  };
}

// ─── FAQ ────────────────────────────────────────────────────────────

export function buildFaqJsonLd(faq: ReadonlyArray<{ q: string; a: string }>): Record<string, unknown> {
  return {
    "@context": SCHEMA,
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

// ─── Article (gidsen / content-pagina's) ────────────────────────────

export type ArticleJsonLdInput = {
  headline: string;
  description: string;
  /** Absoluut of relatief ("/gids/eettafel-maat-kiezen"); wordt absoluut gemaakt. */
  url: string;
  /** ISO-datum (YYYY-MM-DD). */
  datePublished: string;
  /** ISO-datum (YYYY-MM-DD); valt terug op datePublished. */
  dateModified?: string;
  /** Absoluut of relatief pad naar een beeld; weggelaten als leeg. */
  image?: string | null;
};

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${businessInfo.siteUrl}${path}`;
}

/**
 * Article-schema voor adviesgidsen. Auteur en uitgever verwijzen naar het
 * Organization-schema uit de root-layout (`#organization`), zodat er geen
 * tweede organisatie-entiteit ontstaat.
 */
export function buildArticleJsonLd(input: ArticleJsonLdInput): Record<string, unknown> {
  const url = absoluteUrl(input.url);
  const schema: Record<string, unknown> = {
    "@context": SCHEMA,
    "@type": "Article",
    headline: collapseWhitespace(input.headline),
    description: truncateAtWord(input.description, 300),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "nl-NL",
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: { "@id": `${businessInfo.siteUrl}/#organization` },
    publisher: { "@id": `${businessInfo.siteUrl}/#organization` },
  };
  if (input.image) schema.image = absoluteUrl(input.image);
  return schema;
}
