// Client-side meet-helpers (GA4 + Google Ads via gtag.js).
//
// Alle functies zijn no-ops zonder window.gtag en gooien nooit: meten mag de
// webshop nooit breken. De tag zelf (Consent Mode-default, gtag.js-script)
// staat in components/Analytics.tsx; de events hier worden via `gtag()` in
// de dataLayer gezet, ook als gtag.js nog laadt (het inline-script in
// Analytics.tsx definieert window.gtag vóór hydration, dus niets gaat verloren).
//
// Consent Mode v2 "advanced": de tag draait altijd, maar zonder akkoord staan
// alle vier de signalen op 'denied' — Google zet dan geen cookies en stuurt
// alleen cookieloze pings (gemodelleerde conversies). Bij "Accepteren" roept
// CookieBanner `applyConsent("accepted")` aan.
//
// Documentatie voor de eigenaar: docs/tracking.md.

import { getCategory } from "@/lib/categories";

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
export const ADS_PURCHASE_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;

export const GA4_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;
export const ADS_ID_PATTERN = /^AW-\d{6,15}$/;

export const CURRENCY = "EUR"; // zelfde valuta als components/ui/price.tsx en Mollie

/** Dedup-sleutel voor purchase per bestelnummer (localStorage). Zelfde prefix
 *  als de oude Ads-only implementatie, zodat reeds gemelde orders gemeld blijven. */
const PURCHASE_STORAGE_PREFIX = "mokka_ads_purchase_";

export const hasGa4 = (): boolean => Boolean(GA4_ID && GA4_ID_PATTERN.test(GA4_ID));
export const hasAds = (): boolean => Boolean(ADS_ID && ADS_ID_PATTERN.test(ADS_ID));
export const hasAdsPurchaseLabel = (): boolean => hasAds() && Boolean(ADS_PURCHASE_LABEL);
export const isAnalyticsEnabled = (): boolean => hasGa4() || hasAds();

export type ConsentChoice = "accepted" | "declined";

type Gtag = (...args: unknown[]) => void;

/** window.gtag als die bestaat (gezet door het inline bootstrap-script). */
export function getGtag(): Gtag | null {
  if (typeof window === "undefined") return null;
  const candidate: unknown = (window as Window & { gtag?: unknown }).gtag;
  return typeof candidate === "function" ? (candidate as Gtag) : null;
}

function gtagSafe(...args: unknown[]): boolean {
  try {
    const gtag = getGtag();
    if (!gtag) return false;
    gtag(...args);
    return true;
  } catch {
    return false;
  }
}

// ─── Consent Mode v2 ───────────────────────────────────────────────

export function consentStateFor(choice: ConsentChoice): Record<string, "granted" | "denied"> {
  const v = choice === "accepted" ? "granted" : "denied";
  return { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v };
}

/**
 * Consent-update richting Google na een keuze in de cookiebanner. Bij
 * 'declined' blijft/wordt alles 'denied' (cookieloze pings), bij 'accepted'
 * gaat alles naar 'granted'. Veilig om vaker aan te roepen.
 */
export function applyConsent(choice: ConsentChoice): void {
  gtagSafe("consent", "update", consentStateFor(choice));
}

// ─── E-commerce items ──────────────────────────────────────────────

/** GA4 e-commerce item (https://developers.google.com/analytics/devguides/collection/ga4/reference/events#purchase_item). */
export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
};

/** Minimale productgegevens die een pagina/handler aanlevert. */
export type AnalyticsProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  /** Stukprijs incl. btw zoals getoond (bij maat/opties: de regelprijs). */
  price: number;
};

/** Winkelwagenregel (structureel gelijk aan CartItemType, zonder import-cyclus). */
export type AnalyticsCartLine = {
  productId: string;
  variantLabel: string | null;
  nachtkast: number;
  voetbank: number;
  quantity: number;
  product: { id: string; slug: string; name: string; category: string; price: number };
};

/** Orderregel zoals de bedankpagina die van de server krijgt. */
export type AnalyticsOrderItem = {
  productId: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  price: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function categoryLabel(slug: string): string {
  return getCategory(slug)?.label ?? slug;
}

/** Variantlabel: maat + opties (nachtkast/voetbank), gescheiden door " · ". */
export function variantLabelOf(line: { variantLabel?: string | null; nachtkast?: number; voetbank?: number }): string | undefined {
  const parts = [
    line.variantLabel ? line.variantLabel : null,
    line.nachtkast && line.nachtkast > 0 ? `${line.nachtkast} nachtkast${line.nachtkast > 1 ? "en" : ""}` : null,
    line.voetbank && line.voetbank > 0 ? "voetbank" : null,
  ].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function productToItem(product: AnalyticsProduct, quantity = 1, variant?: string): AnalyticsItem {
  return {
    // item_id = Prisma-id: gelijk aan g:id in de Shopping-feed (lib/google-shopping.ts).
    item_id: product.id,
    item_name: product.name,
    item_category: categoryLabel(product.category),
    ...(variant ? { item_variant: variant } : {}),
    price: round2(product.price),
    quantity: Math.max(1, Math.floor(quantity)),
  };
}

export function cartLinesToItems(lines: ReadonlyArray<AnalyticsCartLine>): AnalyticsItem[] {
  return lines.map((l) => productToItem(l.product, l.quantity, variantLabelOf(l)));
}

export function orderItemsToItems(items: ReadonlyArray<AnalyticsOrderItem>): AnalyticsItem[] {
  return items.map((it) => ({
    item_id: it.productId,
    item_name: it.productName,
    ...(it.variantLabel ? { item_variant: it.variantLabel } : {}),
    price: round2(it.price),
    quantity: Math.max(1, Math.floor(it.quantity)),
  }));
}

export function itemsValue(items: ReadonlyArray<AnalyticsItem>): number {
  return round2(items.reduce((sum, it) => sum + it.price * it.quantity, 0));
}

// ─── Events ────────────────────────────────────────────────────────

function sendEvent(name: string, params: Record<string, unknown>): void {
  if (!isAnalyticsEnabled()) return;
  gtagSafe("event", name, params);
}

/** PDP bekeken. */
export function trackViewItem(product: AnalyticsProduct, variant?: string): void {
  const items = [productToItem(product, 1, variant)];
  sendEvent("view_item", { currency: CURRENCY, value: itemsValue(items), items });
}

/** Product in de winkelwagen gelegd. */
export function trackAddToCart(product: AnalyticsProduct, quantity: number, variant?: string): void {
  const items = [productToItem(product, quantity, variant)];
  sendEvent("add_to_cart", { currency: CURRENCY, value: itemsValue(items), items });
}

/** Winkelwagen (drawer of /cart) geopend. */
export function trackViewCart(lines: ReadonlyArray<AnalyticsCartLine>): void {
  if (lines.length === 0) return;
  const items = cartLinesToItems(lines);
  sendEvent("view_cart", { currency: CURRENCY, value: itemsValue(items), items });
}

/** Start van het afrekenen (knop in drawer én mount van /checkout). */
export function trackBeginCheckout(lines: ReadonlyArray<AnalyticsCartLine>, value?: number): void {
  if (lines.length === 0) return;
  const items = cartLinesToItems(lines);
  sendEvent("begin_checkout", { currency: CURRENCY, value: round2(value ?? itemsValue(items)), items });
}

/** Bezorggegevens ingevuld (checkout-submit). `shippingTier` bv. "gratis" | "standaard". */
export function trackAddShippingInfo(lines: ReadonlyArray<AnalyticsCartLine>, value: number, shippingTier: string): void {
  if (lines.length === 0) return;
  sendEvent("add_shipping_info", {
    currency: CURRENCY,
    value: round2(value),
    shipping_tier: shippingTier,
    items: cartLinesToItems(lines),
  });
}

/** Betaalmethode gekozen (checkout-submit). `paymentType` = Mollie-method-id (ideal, klarna, …). */
export function trackAddPaymentInfo(lines: ReadonlyArray<AnalyticsCartLine>, value: number, paymentType: string): void {
  if (lines.length === 0) return;
  sendEvent("add_payment_info", {
    currency: CURRENCY,
    value: round2(value),
    ...(paymentType ? { payment_type: paymentType } : {}),
    items: cartLinesToItems(lines),
  });
}

// ─── Enhanced Conversions (user_data) ──────────────────────────────

export type UserData = {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  /** ISO-2 (NL | BE). */
  country?: string;
};

const DIAL_CODE: Record<string, string> = { NL: "31", BE: "32" };

/**
 * Telefoonnummer naar E.164 (+31612345678) zoals Enhanced Conversions eist.
 * Onbekend formaat → undefined (dan liever geen phone dan een foute hash).
 */
export function normalizePhoneE164(phone: string | undefined, country: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("+")) return /^\+\d{8,15}$/.test(digits) ? digits : undefined;
  if (digits.startsWith("00")) return /^\d{10,17}$/.test(digits) ? `+${digits.slice(2)}` : undefined;
  const dial = DIAL_CODE[(country ?? "NL").toUpperCase()];
  if (!dial) return undefined;
  const national = digits.startsWith("0") ? digits.slice(1) : digits;
  return /^\d{8,10}$/.test(national) ? `+${dial}${national}` : undefined;
}

/**
 * Enhanced Conversions (web): klantgegevens meegeven vóór het conversie-event.
 * gtag.js hasht ze zelf (SHA-256) voordat ze het apparaat verlaten; ze worden
 * nergens gelogd. Alleen aanroepen bij cookie-akkoord (ad_user_data granted).
 */
export function setUserData(data: UserData): void {
  if (!hasAds()) return;
  const email = data.email.trim().toLowerCase();
  if (!email) return;
  const phone = normalizePhoneE164(data.phone, data.country);
  const address = {
    ...(data.firstName ? { first_name: data.firstName.trim() } : {}),
    ...(data.lastName ? { last_name: data.lastName.trim() } : {}),
    ...(data.street ? { street: data.street.trim() } : {}),
    ...(data.city ? { city: data.city.trim() } : {}),
    ...(data.postalCode ? { postal_code: data.postalCode.replace(/\s+/g, "").toUpperCase() } : {}),
    ...(data.country ? { country: data.country.trim().toUpperCase() } : {}),
  };
  gtagSafe("set", "user_data", {
    email,
    ...(phone ? { phone_number: phone } : {}),
    ...(Object.keys(address).length > 0 ? { address } : {}),
  });
}

// ─── Purchase ──────────────────────────────────────────────────────

export type PurchaseOrder = {
  orderNumber: string;
  /** Totaal incl. btw en verzending (= Order.total). */
  total: number;
  /** Verzendkosten incl. btw (= Order.shipping). */
  shipping: number;
  /** Btw-bedrag als bekend; anders wordt 21/121 van het totaal genomen. */
  tax?: number;
  items: ReadonlyArray<AnalyticsOrderItem>;
  newCustomer: boolean;
  /** Mollie-betaalmethode (ideal, klarna, …), optioneel. */
  paymentMethod?: string | null;
};

/** Btw-deel van een bedrag incl. btw bij één tarief (21%). */
export function vatPortion(amountInclVat: number, ratePercent = 21): number {
  return round2(amountInclVat - amountInclVat / (1 + ratePercent / 100));
}

function alreadyReported(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markReported(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // localStorage geblokkeerd — hooguit een dubbele melding bij refresh
  }
}

export function isPurchaseReported(orderNumber: string): boolean {
  return alreadyReported(PURCHASE_STORAGE_PREFIX + orderNumber);
}

/**
 * GA4 `purchase` + Google Ads conversie-event, één keer per bestelnummer
 * (localStorage-vlag: ook niet bij refresh of terugkomen). Retourneert true als
 * er daadwerkelijk iets verstuurd is. Vereist dat window.gtag bestaat.
 *
 * GA4 `value` = som van (prijs × aantal) van de regels (GA4-conventie: zonder
 * verzending; `shipping` en `tax` apart). De Ads-conversie krijgt het
 * ordertotaal (incl. verzending) als waarde — dat is wat de kassa int.
 */
export function trackPurchase(order: PurchaseOrder): boolean {
  if (!isAnalyticsEnabled()) return false;
  const key = PURCHASE_STORAGE_PREFIX + order.orderNumber;
  if (alreadyReported(key)) return false;
  if (!getGtag()) return false;

  const items = orderItemsToItems(order.items);
  const value = items.length > 0 ? itemsValue(items) : round2(order.total - order.shipping);
  const tax = order.tax != null ? round2(order.tax) : vatPortion(order.total);
  let sent = false;

  if (hasGa4()) {
    sent =
      gtagSafe("event", "purchase", {
        transaction_id: order.orderNumber,
        value,
        tax,
        shipping: round2(order.shipping),
        currency: CURRENCY,
        ...(order.paymentMethod ? { payment_type: order.paymentMethod } : {}),
        items,
      }) || sent;
  }

  if (hasAdsPurchaseLabel()) {
    sent =
      gtagSafe("event", "conversion", {
        send_to: `${ADS_ID}/${ADS_PURCHASE_LABEL}`,
        value: round2(order.total),
        currency: CURRENCY,
        transaction_id: order.orderNumber,
        new_customer: order.newCustomer,
      }) || sent;
  }

  if (sent) markReported(key);
  return sent;
}
