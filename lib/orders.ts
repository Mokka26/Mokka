import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { shippingInfo, isEligibleForFreeShipping } from "@/lib/shipping-info";
import { toCents, fromCents, vatFromGrossCents } from "@/lib/money";

export type CheckoutLineInput = {
  productId: string;
  variantLabel?: string | null;
  nachtkast?: number;
  voetbank?: number;
  quantity: number;
};

export type ComputedLine = {
  productId: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  /** Stukprijs in euro's (verkoopprijs, evt. maat-override + opties). */
  price: number;
  /** Stukprijs in centen — basis voor alle optellingen. */
  unitCents: number;
  /** Regeltotaal in centen (unitCents × quantity). */
  totalCents: number;
  /** Btw-deel van het regeltotaal in centen. */
  vatCents: number;
};

export type ComputedOrder = {
  lines: ComputedLine[];
  subtotal: number;
  shipping: number;
  total: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  /** Btw over het totaal, in centen — afgeleid van de regels zodat het exact optelt. */
  vatCents: number;
  country: string;
};

type SizeVariant = { label: string; price?: number };

/** Minimale productvelden die nodig zijn om één regel te prijzen. */
export type PriceableProduct = {
  price: number;
  sizeVariants: string | null;
  nachtkastMode: string | null;
  nachtkastPrice: number | null;
  nachtkastPrice2: number | null;
  voetbankMode: string | null;
  voetbankPrice: number | null;
};

export type LinePricing =
  | { ok: true; unitCents: number; variantLabel: string | null; fullLabel: string | null }
  | { ok: false; reason: "VARIANT_MISSING" | "NO_PRICE" };

/**
 * Prijs voor de gekozen maat. Geeft `null` als het product maat-varianten heeft
 * maar het meegestuurde label op géén enkele variant matcht (bv. maat hernoemd
 * of verwijderd in de admin) — dan mag NIET stilletjes op de basisprijs worden
 * teruggevallen; de checkout hoort te weigeren.
 */
function variantPrice(sizeVariants: string | null, label: string | null, fallback: number): number | null {
  if (!sizeVariants) return fallback;
  let arr: SizeVariant[];
  try { arr = JSON.parse(sizeVariants) as SizeVariant[]; } catch { return fallback; }
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  if (!label) return fallback; // varianten aanwezig maar geen maat gekozen → basisprijs
  const match = arr.find((v) => v.label === label);
  if (!match) return null; // maat bestaat niet (meer) → fout
  return typeof match.price === "number" && match.price > 0 ? match.price : fallback;
}

/**
 * Prijst één regel (maat + nachtkast + voetbank) vers uit de productdata.
 * Gedeeld door computeOrder (checkout) en getCartSnapshot (cart-sync) zodat
 * beide altijd dezelfde prijs geven.
 */
export function priceLine(
  p: PriceableProduct,
  opts: { variantLabel?: string | null; nachtkast?: number; voetbank?: number },
): LinePricing {
  const label = opts.variantLabel?.trim() || null;
  const sizePrice = variantPrice(p.sizeVariants, label, p.price);
  if (sizePrice === null) return { ok: false, reason: "VARIANT_MISSING" };
  if (!(sizePrice > 0)) return { ok: false, reason: "NO_PRICE" };
  // Nachtkast-toeslag — alleen bij modus "optional" (apart bij te bestellen);
  // prijs komt vers uit de DB (client-bedrag wordt nooit vertrouwd). Max 2.
  // "included" en "none" geven geen toeslag.
  const nk = p.nachtkastMode === "optional" ? Math.max(0, Math.min(2, Math.floor(opts.nachtkast ?? 0))) : 0;
  const nkAddon = nk === 1 ? (p.nachtkastPrice ?? 0)
    : nk === 2 ? (p.nachtkastPrice2 ?? (p.nachtkastPrice ?? 0) * 2)
    : 0;
  // Voetbank-toeslag — alleen bij modus "optional", 0/1.
  const vb = p.voetbankMode === "optional" ? Math.max(0, Math.min(1, Math.floor(opts.voetbank ?? 0))) : 0;
  const vbAddon = vb * (p.voetbankPrice ?? 0);
  const unitCents = toCents(sizePrice) + toCents(nkAddon) + toCents(vbAddon);
  const extras = [
    nk > 0 ? `${nk} nachtkast${nk > 1 ? "en" : ""}` : "",
    vb > 0 ? "voetbank" : "",
  ].filter(Boolean).join(" · ");
  const fullLabel = extras ? `${label ?? ""}${label ? " · " : ""}${extras}`.trim() : label;
  return { ok: true, unitCents, variantLabel: label, fullLabel };
}

/**
 * Berekent het ordertotaal SERVER-SIDE uit de database, in centen. De prijs
 * die de client stuurt wordt nooit vertrouwd: elke prijs komt vers uit Product
 * (incl. de maat-override). Gooit een Error bij een ongeldige/onverkoopbare
 * regel. `country` bepaalt of gratis verzending geldt (NL/BE).
 */
export async function computeOrder(items: CheckoutLineInput[], country = "NL"): Promise<ComputedOrder> {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Lege winkelwagen");

  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, hidden: false, deletedAt: null },
    select: { id: true, name: true, price: true, stock: true, sizeVariants: true, nachtkastMode: true, nachtkastPrice: true, nachtkastPrice2: true, voetbankMode: true, voetbankPrice: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const vat = shippingInfo.vatRatePercent;
  const lines: ComputedLine[] = [];
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) throw new Error("Product niet (meer) beschikbaar");
    const qty = Math.max(1, Math.min(99, Math.floor(item.quantity)));
    // Voorraadcheck — voorkomt overselling (order + betaling voor niet-leverbaar).
    if (p.stock <= 0) throw new Error(`${p.name} is uitverkocht`);
    if (qty > p.stock) throw new Error(`${p.name}: nog ${p.stock} op voorraad`);
    const priced = priceLine(p, item);
    if (!priced.ok) {
      throw new Error(
        priced.reason === "VARIANT_MISSING"
          ? `De gekozen maat voor ${p.name} is niet meer beschikbaar`
          : `Geen geldige prijs voor ${p.name}`,
      );
    }
    const totalCents = priced.unitCents * qty;
    lines.push({
      productId: p.id,
      productName: p.name,
      variantLabel: priced.fullLabel,
      quantity: qty,
      price: fromCents(priced.unitCents),
      unitCents: priced.unitCents,
      totalCents,
      vatCents: vatFromGrossCents(totalCents, vat),
    });
  }

  // Voorraad ook per PRODUCT aggregeren: hetzelfde bed in twee maten/opties zijn
  // aparte regels — samen mogen ze de voorraad niet overschrijden (de per-regel
  // check hierboven ziet dat niet).
  const perProduct = new Map<string, number>();
  for (const l of lines) perProduct.set(l.productId, (perProduct.get(l.productId) ?? 0) + l.quantity);
  for (const [pid, totalQty] of perProduct) {
    const p = byId.get(pid)!;
    if (totalQty > p.stock) throw new Error(`${p.name}: nog ${p.stock} op voorraad`);
  }

  const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);
  const shippingCents = isEligibleForFreeShipping(fromCents(subtotalCents), country)
    ? 0
    : toCents(shippingInfo.rates.standard);
  const totalCents = subtotalCents + shippingCents;
  const vatCents = lines.reduce((s, l) => s + l.vatCents, 0) + vatFromGrossCents(shippingCents, vat);
  return {
    lines,
    subtotal: fromCents(subtotalCents),
    shipping: fromCents(shippingCents),
    total: fromCents(totalCents),
    subtotalCents,
    shippingCents,
    totalCents,
    vatCents,
    country,
  };
}

// Leesbaar alfabet zonder verwarrende tekens (0/O, 1/I/L) — klanten lezen het
// ordernummer aan de telefoon voor.
const ORDER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Uniek, leesbaar ordernummer: MOK-YYMMDD-XXXXX. Het random deel komt uit
 * crypto.randomBytes (niet Math.random): ~28 miljoen combinaties per dag, en
 * het ordernummer mag nooit voorspelbaar zijn. Bij een (extreem zeldzame)
 * botsing vangt de checkout P2002 af en probeert één keer opnieuw.
 */
export function generateOrderNumber(now: number = Date.now()): string {
  const d = new Date(now);
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const bytes = randomBytes(5);
  let rand = "";
  for (let i = 0; i < 5; i++) rand += ORDER_ALPHABET[bytes[i] % ORDER_ALPHABET.length];
  return `MOK-${yy}${mm}${dd}-${rand}`;
}

/** Niet-raadbare publieke token voor de bedankpagina (32 hex = 128 bit). */
export function generatePublicToken(): string {
  return randomBytes(16).toString("hex");
}
