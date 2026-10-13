import { shippingInfo } from "@/lib/shipping-info";

/**
 * Levertijd als lopende zin — één helper voor ProductCard, PDP-koopblok,
 * CartDrawer en CartItem, zodat "Levertijd: binnen 5 werkdagen" overal
 * gelijk is (geen hoofdletter midden in de zin).
 */

/** Zet de eerste letter in kleine letters, behalve bij een afkorting/eigennaam ("DHL", "PostNL"). */
export function lowercaseFirst(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const firstWord = t.split(/\s+/)[0];
  const restOfWord = firstWord.slice(1);
  // Hoofdletters verderop in het eerste woord → afkorting of merknaam: laten staan.
  if (restOfWord !== restOfWord.toLowerCase()) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** De levertijd zelf ("binnen 5 werkdagen"); valt terug op lib/shipping-info. */
export function formatDeliveryTime(deliveryTime: string | null | undefined): string {
  const raw = deliveryTime?.trim() || shippingInfo.deliveryTime.inStock;
  return lowercaseFirst(raw.replace(/[.\s]+$/, ""));
}

/** Volledige regel: "Levertijd: binnen 5 werkdagen". */
export function deliveryLine(deliveryTime: string | null | undefined): string {
  return `Levertijd: ${formatDeliveryTime(deliveryTime)}`;
}
