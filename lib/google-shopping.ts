/**
 * Google Shopping-productfeed (Merchant Center, RSS 2.0 met g:-namespace).
 *
 * Bron van waarheid voor de mapping van webshop-categorieën naar Google's
 * productcategorie-taxonomie en voor de opbouw van feed-items. De route
 * `app/feed/google-shopping.xml/route.ts` serveert het resultaat.
 * Feedregels en custom labels: docs/google-shopping.md.
 *
 * Spec: https://support.google.com/merchants/answer/7052112
 */
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { getCategory, productUrl } from "@/lib/categories";
import { parseImages } from "@/lib/imageHelpers";
import {
  formatDimensions,
  nameHasType,
  parseDimensions,
  parseSpecs,
  productTypeLabel,
  stripProductCode,
  type Dimensions,
} from "@/lib/specs";

/**
 * Adviesprijs (listPrice) als doorgestreepte referentieprijs in de feed
 * (`price` = listPrice, `sale_price` = verkoopprijs). Staat UIT: onder de
 * Omnibus-richtlijn moet een "van"-prijs de laagste prijs van de voorgaande
 * 30 dagen zijn, en dat is voor de leveranciers-adviesprijzen niet aantoonbaar.
 * Zie docs/google-shopping.md.
 */
export const USE_LIST_PRICE_AS_REFERENCE = false;

/** Het subset van Product-velden dat de feed nodig heeft (Prisma select). */
export type FeedProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  listPrice: number | null;
  category: string;
  images: string;
  specs: string | null;
  sizeVariants: string | null;
  stock: number;
  deliveryTime: string | null;
  colorName: string | null;
  featured: boolean;
  hidden: boolean;
  deletedAt: Date | null;
  createdAt: Date;
};

export const FEED_PRODUCT_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  price: true,
  listPrice: true,
  category: true,
  images: true,
  specs: true,
  sizeVariants: true,
  stock: true,
  deliveryTime: true,
  colorName: true,
  featured: true,
  hidden: true,
  deletedAt: true,
  createdAt: true,
} as const;

/**
 * Google productcategorie-ID per DB-categorie. ID's geverifieerd tegen de
 * officiële Nederlandse taxonomie (taxonomy-with-ids.nl-NL.txt, 2026-10-12).
 */
const GOOGLE_PRODUCT_CATEGORY: Record<string, number> = {
  banken: 460, // Meubelen > Sofa's
  hoekbanken: 460,
  bankstellen: 460,
  fauteuils: 6499, // Meubelen > Stoelen > Armstoelen, relaxstoelen en slaapbanken
  stoelen: 443, // Meubelen > Stoelen (umbrella: eetkamerstoelen + fauteuils)
  eetkamerstoelen: 5886, // Meubelen > Stoelen > Keuken- en eetkamerstoelen
  poefs: 458, // Meubelen > Poefs
  bedden: 505764, // Meubelen > Bedden en accessoires > Bedden en ledikanten
  matrassen: 2696, // Meubelen > Bedden en accessoires > Matrassen
  slaapkamers: 6346, // Meubelen > Meubelsets > Meubelsets voor slaapkamers
  jeugdkamers: 6346,
  kasten: 6356, // Meubelen > Kasten en opbergmeubelen
  kledingkasten: 4063, // Meubelen > Kasten en opbergmeubelen > Grote kledingkasten
  // Let op de vertaling: Google's "Dressoirs" (4195) is het Amerikaanse
  // "Dressers" = ladekasten/commodes; een Nederlands dressoir (lage kast met
  // deuren voor de woon-/eetkamer) is "Glazenkasten en buffetten" (447).
  dressoirs: 447, // Meubelen > Kasten en opbergmeubelen > Glazenkasten en buffetten (Buffets & Sideboards)
  ladekasten: 4195, // Meubelen > Kasten en opbergmeubelen > Dressoirs (Dressers = ladekasten/commodes)
  nachtkastjes: 462, // Meubelen > Tafels > Nachtkastjes
  kapstokken: 5708, // Huis en tuin > Decoratie > Kapstokken voor jassen en hoeden
  schoenenkasten: 5559, // Huis en tuin > … > Rekken en opbergsystemen voor schoenen
  tafels: 6392, // Meubelen > Tafels
  eettafels: 4355, // Meubelen > Tafels > Keuken- en eetkamertafels
  salontafels: 1395, // Meubelen > Tafels > Accenttafels > Salontafels
  bijzettafels: 1549, // Meubelen > Tafels > Accenttafels > Bijzettafels
  "tv-meubels": 457, // Meubelen > Entertainment- en mediasystemen (Entertainment Centers & TV Stands)
  verlichting: 594, // Huis en tuin > Verlichting
  plafondlampen: 2524, // Huis en tuin > Verlichting > Lichtarmaturen > Plafondverlichting
  vloerlampen: 4636, // Huis en tuin > Verlichting > Lampen
  tafellampen: 4636,
  wandlampen: 6073, // Huis en tuin > Verlichting > Lichtarmaturen > Muurverlichting
  spiegels: 595, // Huis en tuin > Decoratie > Spiegels
};
const FALLBACK_GOOGLE_CATEGORY = 436; // Meubelen

// Google-limieten
const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;
const MAX_ADDITIONAL_IMAGES = 10;
const MAX_MATERIAL = 200;
const TITLE_SEPARATOR = " – ";
const NEW_PRODUCT_DAYS = 30;
const FAST_DELIVERY_MAX_DAYS = 5;

type SizeVariant = { label: string; price: number; listPrice?: number };

function parseSizeVariants(raw: string | null): SizeVariant[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((v): SizeVariant[] => {
      if (!v || typeof v !== "object") return [];
      const { label, price, listPrice } = v as Record<string, unknown>;
      if (typeof label !== "string" || typeof price !== "number" || price <= 0) return [];
      return [{ label, price, listPrice: typeof listPrice === "number" ? listPrice : undefined }];
    });
  } catch {
    return [];
  }
}

/** EAN/GTIN: 8, 12, 13 of 14 cijfers. Anders weglaten (Google keurt anders af). */
function validGtin(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\s/g, "");
  return /^\d{8}$|^\d{12,14}$/.test(digits) ? digits : null;
}

/**
 * Levertijd-tekst ("Binnen 5 werkdagen", "4 tot 8 weken", "4-10 weken") →
 * handling time in werkdagen. Onbekend formaat = null (attribuut weglaten).
 */
export function parseHandlingDays(text: string | null): { min: number; max: number } | null {
  if (!text) return null;
  const nums = text.match(/\d+/g)?.map(Number).filter((n) => n > 0) ?? [];
  if (nums.length === 0) return null;
  const factor = /we(e)?k/i.test(text) ? 5 : 1;
  const min = Math.min(...nums) * factor;
  const max = Math.max(...nums) * factor;
  // "Binnen 5 werkdagen" = 0-5 dagen
  return nums.length === 1 && /binnen/i.test(text) ? { min: 0, max } : { min, max };
}

/** Prijs-bucket voor custom_label_1 (segmentatie in Performance Max). */
export function priceBucket(price: number): string {
  if (price < 250) return "0-250";
  if (price < 500) return "250-500";
  if (price < 1000) return "500-1000";
  if (price < 2000) return "1000-2000";
  return "2000+";
}

/** Levertijd-label voor custom_label_3 en transit_time_label. */
export function deliveryLabel(handling: { min: number; max: number } | null): string {
  return handling && handling.max <= FAST_DELIVERY_MAX_DAYS ? "snel-leverbaar" : "langere-levertijd";
}

// Tekens die in XML 1.0 niet mogen voorkomen (C0-controls behalve tab/LF/CR,
// losse surrogaten, U+FFFE/FFFF): Merchant Center weigert anders het hele
// bestand. Ze komen voor in geplakte leveranciersteksten.
const INVALID_XML_CHARS = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

export function xmlEscape(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * HTML-tags en entiteiten eruit, witruimte samengevoegd. `&amp;` wordt als
 * LAATSTE gedecodeerd: anders wordt "&amp;lt;" eerst "&lt;" en daarna "<" —
 * dubbel decoderen dat tekst als markup laat lezen.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function money(value: number): string {
  return `${value.toFixed(2)} EUR`;
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}>${xmlEscape(String(value))}</${name}>`;
}

function cm(value: number | undefined): string | null {
  return value === undefined ? null : `${Number.isInteger(value) ? value : value.toFixed(1)} cm`;
}

/** Afkappen op max. lengte, bij voorkeur op een scheidingsteken of spatie. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const atSeparator = cut.lastIndexOf(TITLE_SEPARATOR);
  if (atSeparator > max * 0.5) return cut.slice(0, atSeparator).trim();
  const atSpace = cut.lastIndexOf(" ");
  return (atSpace > max * 0.5 ? cut.slice(0, atSpace) : cut).trim();
}

function containsWord(haystack: string, needle: string | null | undefined): boolean {
  if (!needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * "<producttype> <naam zonder code> – <model/serie> – <materiaal> – <kleur> – <afmeting>",
 * zonder herhalingen, afgekapt op 150 tekens. Blijft er na het weghalen van de
 * leverancierscode niets onderscheidends over (geen model, materiaal of
 * afmeting; bv. "Plafondlamp zilver" ×15), dan gaat het artikelnummer mee,
 * zodat titels binnen de feed uniek blijven.
 */
export function buildTitle(product: FeedProduct, specs: Record<string, string>, dimensionLabel: string | null): string {
  const baseName = stripProductCode(product.name);
  const type = nameHasType(product.category, baseName) ? null : productTypeLabel(product.category);
  const head = [type, baseName].filter(Boolean).join(" ");
  const model = specs.Serie ?? specs.Model ?? null;
  const modelPart = model && !containsWord(head, model) ? model : null;
  const material = specs.Materiaal && !containsWord(head, specs.Materiaal) ? specs.Materiaal : null;
  const color = product.colorName ?? specs.Kleur ?? null;
  const colorPart = color && !containsWord(head, color) ? color : null;
  const dims = dimensionLabel && !containsWord(head, dimensionLabel) ? dimensionLabel : null;
  const codeStripped = baseName !== product.name.trim();
  const distinguishing = modelPart || material || dims;
  const codePart = codeStripped && !distinguishing && specs.Artikelnummer ? specs.Artikelnummer : null;
  return truncate([head, modelPart, material, colorPart, dims, codePart].filter(Boolean).join(TITLE_SEPARATOR), MAX_TITLE);
}

/**
 * Beschrijving: productbeschrijving zonder HTML; ontbreekt die, dan een
 * feitelijke regel uit naam, categorie en afmetingen (Google eist het veld).
 */
export function buildDescription(product: FeedProduct, specs: Record<string, string>, dimensionLabel: string | null): string {
  const text = stripHtml(product.description ?? "");
  if (text) return text.slice(0, MAX_DESCRIPTION);
  const category = getCategory(product.category);
  const parts = [
    `${stripProductCode(product.name)}${category ? ` uit de categorie ${category.name}` : ""} van ${businessInfo.name}.`,
    dimensionLabel ? `Afmetingen: ${dimensionLabel}.` : null,
    specs.Materiaal ? `Materiaal: ${specs.Materiaal}.` : null,
    `Prijzen incl. btw.`,
  ];
  return parts.filter(Boolean).join(" ");
}

/** Maatvariant-label ("160 × 200") → afmetingen; anders specs.Afmetingen. */
function dimensionsFor(product: FeedProduct, specs: Record<string, string>, variantLabel?: string): Dimensions | null {
  if (variantLabel) return parseDimensions(variantLabel, product.category);
  return parseDimensions(specs.Afmetingen, product.category);
}

type Offer = {
  id: string;
  price: number;
  listPrice: number | null;
  link: string;
  itemGroupId?: string;
  size?: string;
};

function buildItem(product: FeedProduct, offer: Offer): string {
  const images = parseImages(product.images).map((i) => i.url);
  if (images.length === 0) return ""; // Google eist een afbeelding
  if (offer.price <= 0) return "";
  const specs = parseSpecs(product.specs);
  const category = getCategory(product.category);
  const dims = dimensionsFor(product, specs, offer.size);
  // Maatvariant: het label is de matrasmaat ("160 × 200") → "160 × 200 cm" in de titel.
  const dimensionLabel = offer.size ? `${offer.size} cm` : (formatDimensions(dims) ?? specs.Afmetingen ?? null);
  const handling = parseHandlingDays(product.deliveryTime);
  const shippingCost = offer.price >= shippingInfo.freeShippingThreshold ? 0 : shippingInfo.rates.standard;
  const isNew = Date.now() - product.createdAt.getTime() < NEW_PRODUCT_DAYS * 86400e3;

  // Prijs: verkoopprijs. Alleen met USE_LIST_PRICE_AS_REFERENCE wordt de
  // adviesprijs als doorgestreepte `price` gebruikt en de verkoopprijs `sale_price`.
  const showReference = USE_LIST_PRICE_AS_REFERENCE && offer.listPrice !== null && offer.listPrice > offer.price;

  // Identificatie: `brand` is verplicht voor Merchant Center en gaat altijd
  // mee (specs.Merk = de fabrikant, anders de winkelnaam).
  //  - EAN aanwezig → brand + gtin + mpn
  //  - geen EAN → brand + identifier_exists = no (dan ook geen mpn: brand +
  //    mpn geldt als identificatie en spreekt identifier_exists tegen)
  // Geeft Merchant Center "GTIN-mismatch" op items met EAN maar zonder
  // specs.Merk, vul dan per leverancier de echte fabrikant in specs.Merk.
  const brand = specs.Merk ?? businessInfo.name;
  const gtin = validGtin(specs.EAN);
  const mpn = specs.Artikelnummer ?? null;
  const identifierParts = gtin
    ? [tag("g:brand", brand), tag("g:gtin", gtin), mpn ? tag("g:mpn", mpn) : ""]
    : [tag("g:brand", brand), tag("g:identifier_exists", "no")];

  const parts = [
    tag("g:id", offer.id),
    tag("g:title", buildTitle(product, specs, dimensionLabel)),
    tag("g:description", buildDescription(product, specs, dimensionLabel)),
    tag("g:link", offer.link),
    tag("g:image_link", images[0]),
    ...images.slice(1, 1 + MAX_ADDITIONAL_IMAGES).map((url) => tag("g:additional_image_link", url)),
    tag("g:availability", "in_stock"),
    tag("g:price", money(showReference && offer.listPrice !== null ? offer.listPrice : offer.price)),
    showReference ? tag("g:sale_price", money(offer.price)) : "",
    ...identifierParts,
    tag("g:condition", "new"),
    tag("g:google_product_category", GOOGLE_PRODUCT_CATEGORY[product.category] ?? FALLBACK_GOOGLE_CATEGORY),
    // Semantische groep: tv-meubels onder Opbergen, poefs onder Zitten (feedGroup).
    category ? tag("g:product_type", `Meubels > ${category.feedGroup ?? category.group} > ${category.label}`) : "",
    tag("g:color", product.colorName ?? specs.Kleur ?? null),
    tag("g:material", specs.Materiaal?.slice(0, MAX_MATERIAL) ?? null),
    offer.itemGroupId ? tag("g:item_group_id", offer.itemGroupId) : "",
    offer.size ? tag("g:size", offer.size) : "",
    // Afmetingen: width = breedte, length = diepte, height = hoogte; rond → breedte = diepte = Ø.
    tag("g:product_width", cm(dims?.diameter ?? dims?.w)),
    tag("g:product_length", cm(dims?.diameter ?? dims?.d)),
    tag("g:product_height", cm(dims?.h)),
    // Verzending: werkelijke kosten voor dit item (gratis vanaf drempel), per land.
    ...shippingInfo.freeShippingCountries.map(
      (country) =>
        `<g:shipping>${tag("g:country", country)}${tag("g:service", "Standaard")}${tag("g:price", money(shippingCost))}</g:shipping>`,
    ),
    handling ? tag("g:min_handling_time", handling.min) : "",
    handling ? tag("g:max_handling_time", handling.max) : "",
    tag("g:transit_time_label", deliveryLabel(handling)),
    // Custom labels (campagne-segmentatie; label_0 is de basis voor "alleen favorieten adverteren").
    tag("g:custom_label_0", product.featured ? "favoriet" : "regulier"),
    tag("g:custom_label_1", priceBucket(offer.price)),
    tag("g:custom_label_2", product.category),
    tag("g:custom_label_3", deliveryLabel(handling)),
    isNew ? tag("g:custom_label_4", "nieuw") : "",
  ];
  return `<item>${parts.filter(Boolean).join("")}</item>`;
}

/** Alleen zichtbare, niet-verwijderde producten met voorraad en een prijs. */
export function isFeedEligible(product: FeedProduct): boolean {
  if (product.hidden || product.deletedAt !== null || product.stock <= 0) return false;
  return product.price > 0 || parseSizeVariants(product.sizeVariants).length > 0;
}

/**
 * Eén product → één item, of één item per maatvariant (item_group_id = product,
 * link met ?maat=<label> zodat de PDP de juiste maat en prijs toont).
 * g:id is het stabiele Prisma-id (Google: max 50 tekens; slugs kunnen langer zijn).
 */
export function buildItems(product: FeedProduct): string[] {
  if (!isFeedEligible(product)) return [];
  const link = `${businessInfo.siteUrl}${productUrl(product)}`;
  const variants = parseSizeVariants(product.sizeVariants);
  if (variants.length === 0) {
    return [buildItem(product, { id: product.id, price: product.price, listPrice: product.listPrice, link })];
  }
  return variants.map((v, i) =>
    buildItem(product, {
      id: `${product.id}-${i + 1}`,
      price: v.price,
      listPrice: v.listPrice ?? null,
      link: `${link}?maat=${encodeURIComponent(v.label)}`,
      itemGroupId: product.id,
      size: v.label,
    }),
  );
}

export function buildFeedDocument(products: FeedProduct[]): { xml: string; itemCount: number } {
  const items = products.flatMap(buildItems).filter(Boolean);
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n` +
    `${tag("title", businessInfo.name)}${tag("link", businessInfo.siteUrl)}${tag("description", businessInfo.tagline)}\n` +
    `${items.join("\n")}\n</channel>\n</rss>\n`;
  return { xml, itemCount: items.length };
}

export function buildFeed(products: FeedProduct[]): string {
  return buildFeedDocument(products).xml;
}
