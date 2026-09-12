/**
 * Google Shopping-productfeed (Merchant Center, RSS 2.0 met g:-namespace).
 *
 * Bron van waarheid voor de mapping van webshop-categorieën naar Google's
 * productcategorie-taxonomie en voor de opbouw van feed-items. De route
 * `app/feed/google-shopping.xml/route.ts` serveert het resultaat.
 *
 * Spec: https://support.google.com/merchants/answer/7052112
 */
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { getCategory, productUrl } from "@/lib/categories";
import { parseImages } from "@/lib/imageHelpers";

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
  source: string | null;
  featured: boolean;
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
  source: true,
  featured: true,
} as const;

/**
 * Google productcategorie-ID per DB-categorie. ID's uit de officiële
 * taxonomie (taxonomy-with-ids.en-US.txt).
 */
const GOOGLE_PRODUCT_CATEGORY: Record<string, number> = {
  banken: 460, // Furniture > Sofas
  hoekbanken: 460,
  bankstellen: 460,
  fauteuils: 6499, // Furniture > Chairs > Arm Chairs, Recliners & Sleeper Chairs
  stoelen: 5886, // Furniture > Chairs > Kitchen & Dining Room Chairs
  eetkamerstoelen: 5886,
  poefs: 458, // Furniture > Ottomans
  bedden: 505764, // Furniture > Beds & Accessories > Beds & Bed Frames
  matrassen: 2696, // Furniture > Beds & Accessories > Mattresses
  slaapkamers: 6346, // Furniture > Furniture Sets > Bedroom Furniture Sets
  jeugdkamers: 6346,
  kasten: 436, // Furniture (umbrella zonder eigen DB-producten)
  kledingkasten: 4063, // Furniture > Cabinets & Storage > Armoires & Wardrobes
  dressoirs: 447, // Furniture > Cabinets & Storage > Buffets & Sideboards
  ladekasten: 4195, // Furniture > Cabinets & Storage > Dressers
  nachtkastjes: 462, // Furniture > Tables > Nightstands
  kapstokken: 5708, // Home & Garden > Decor > Coat & Hat Racks
  schoenenkasten: 5559, // Home & Garden > ... > Shoe Racks & Organizers
  tafels: 6392, // Furniture > Tables
  eettafels: 4355, // Furniture > Tables > Kitchen & Dining Room Tables
  salontafels: 1395, // Furniture > Tables > Accent Tables > Coffee Tables
  bijzettafels: 1549, // Furniture > Tables > Accent Tables > End Tables
  "tv-meubels": 457, // Furniture > Entertainment Centers & TV Stands
  verlichting: 594, // Home & Garden > Lighting
  plafondlampen: 2524, // Home & Garden > Lighting > Lighting Fixtures > Ceiling Light Fixtures
  vloerlampen: 4636, // Home & Garden > Lighting > Lamps
  tafellampen: 4636,
  wandlampen: 6073, // Home & Garden > Lighting > Lighting Fixtures > Wall Light Fixtures
  spiegels: 595, // Home & Garden > Decor > Mirrors
};
const FALLBACK_GOOGLE_CATEGORY = 436; // Furniture

// Google-limieten
const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;
const MAX_ADDITIONAL_IMAGES = 10;
const MAX_MATERIAL = 200;

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

function parseSpecs(raw: string | null): Record<string, string> {
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
  if (price < 750) return "250-750";
  if (price < 1500) return "750-1500";
  return "1500+";
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value: number): string {
  return `${value.toFixed(2)} EUR`;
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}>${xmlEscape(String(value))}</${name}>`;
}

type Offer = {
  id: string;
  title: string;
  price: number;
  listPrice: number | null;
  itemGroupId?: string;
  size?: string;
};

function buildItem(product: FeedProduct, offer: Offer): string {
  const images = parseImages(product.images).map((i) => i.url);
  if (images.length === 0) return ""; // Google eist een afbeelding
  const specs = parseSpecs(product.specs);
  const category = getCategory(product.category);
  const gtin = validGtin(specs.EAN);
  const mpn = specs.Artikelnummer ?? null;
  const onSale = offer.listPrice !== null && offer.listPrice > offer.price;
  const handling = parseHandlingDays(product.deliveryTime);
  const link = `${businessInfo.siteUrl}${productUrl(product)}`;
  const shippingCost =
    offer.price >= shippingInfo.freeShippingThreshold ? 0 : shippingInfo.rates.standard;

  const parts = [
    tag("g:id", offer.id),
    tag("g:title", offer.title.slice(0, MAX_TITLE)),
    tag("g:description", product.description.trim().slice(0, MAX_DESCRIPTION)),
    tag("g:link", link),
    tag("g:image_link", images[0]),
    ...images.slice(1, 1 + MAX_ADDITIONAL_IMAGES).map((url) => tag("g:additional_image_link", url)),
    tag("g:availability", product.stock > 0 ? "in_stock" : "out_of_stock"),
    // Bij korting: price = adviesprijs, sale_price = wat de klant betaalt.
    tag("g:price", money(onSale && offer.listPrice !== null ? offer.listPrice : offer.price)),
    onSale ? tag("g:sale_price", money(offer.price)) : "",
    tag("g:brand", businessInfo.name),
    gtin ? tag("g:gtin", gtin) : "",
    mpn ? tag("g:mpn", mpn) : "",
    !gtin && !mpn ? tag("g:identifier_exists", "no") : "",
    tag("g:condition", "new"),
    tag(
      "g:google_product_category",
      GOOGLE_PRODUCT_CATEGORY[product.category] ?? FALLBACK_GOOGLE_CATEGORY,
    ),
    category ? tag("g:product_type", `${category.group} > ${category.label}`) : "",
    tag("g:color", product.colorName ?? specs.Kleur ?? null),
    tag("g:material", specs.Materiaal?.slice(0, MAX_MATERIAL) ?? null),
    offer.itemGroupId ? tag("g:item_group_id", offer.itemGroupId) : "",
    offer.size ? tag("g:size", offer.size) : "",
    ...shippingInfo.freeShippingCountries.map(
      (country) =>
        `<g:shipping>${tag("g:country", country)}${tag("g:service", "Standaard")}${tag("g:price", money(shippingCost))}</g:shipping>`,
    ),
    handling ? tag("g:min_handling_time", handling.min) : "",
    handling ? tag("g:max_handling_time", handling.max) : "",
    // Custom labels: segmentatie in Performance Max / Shopping-campagnes.
    tag("g:custom_label_0", product.source ?? null),
    tag("g:custom_label_1", priceBucket(offer.price)),
    tag("g:custom_label_2", product.featured ? "featured" : null),
    tag("g:custom_label_3", handling && handling.max <= 10 ? "snel-leverbaar" : "langere-levertijd"),
  ];
  return `<item>${parts.filter(Boolean).join("")}</item>`;
}

/**
 * Eén product → één item, of één item per maatvariant (item_group_id = product).
 * g:id is het stabiele Prisma-id (Google: max 50 tekens; slugs kunnen langer zijn).
 */
export function buildItems(product: FeedProduct): string[] {
  const variants = parseSizeVariants(product.sizeVariants);
  if (variants.length === 0) {
    return [
      buildItem(product, {
        id: product.id,
        title: product.name,
        price: product.price,
        listPrice: product.listPrice,
      }),
    ];
  }
  return variants.map((v, i) =>
    buildItem(product, {
      id: `${product.id}-${i + 1}`,
      title: `${product.name} ${v.label}`,
      price: v.price,
      listPrice: v.listPrice ?? null,
      itemGroupId: product.id,
      size: v.label,
    }),
  );
}

export function buildFeed(products: FeedProduct[]): string {
  const items = products.flatMap(buildItems).filter(Boolean).join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n` +
    `${tag("title", businessInfo.name)}${tag("link", businessInfo.siteUrl)}${tag("description", businessInfo.tagline)}\n` +
    `${items}\n</channel>\n</rss>\n`
  );
}
