import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { shippingInfo, isEligibleForFreeShipping } from "@/lib/shipping-info";
import { toCents, fromCents, vatFromGrossCents } from "@/lib/money";
import { captureWarning } from "@/lib/sentry";
import { priceLine } from "@/lib/pricing";

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

export { priceLine, type PriceableProduct, type LinePricing } from "@/lib/pricing";

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
      // Kapotte maat-data: weigeren én melden, zodat de admin het kan herstellen.
      if (priced.corrupt) captureWarning("sizeVariants is geen geldige maatlijst", { productId: p.id });
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
