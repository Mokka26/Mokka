import { prisma } from "@/lib/prisma";
import { shippingInfo, isEligibleForFreeShipping } from "@/lib/shipping-info";

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
  price: number; // stukprijs (verkoopprijs, evt. maat-override)
};

export type ComputedOrder = {
  lines: ComputedLine[];
  subtotal: number;
  shipping: number;
  total: number;
};

type SizeVariant = { label: string; price?: number };

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
 * Berekent het ordertotaal SERVER-SIDE uit de database. De prijs die de client
 * stuurt wordt nooit vertrouwd: elke prijs komt vers uit Product (incl. de
 * maat-override). Gooit een Error bij een ongeldige/onverkoopbare regel.
 */
export async function computeOrder(items: CheckoutLineInput[]): Promise<ComputedOrder> {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Lege winkelwagen");

  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, hidden: false, deletedAt: null },
    select: { id: true, name: true, price: true, stock: true, sizeVariants: true, nachtkastMode: true, nachtkastPrice: true, nachtkastPrice2: true, voetbankMode: true, voetbankPrice: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: ComputedLine[] = [];
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) throw new Error("Product niet (meer) beschikbaar");
    const qty = Math.max(1, Math.min(99, Math.floor(item.quantity)));
    // Voorraadcheck — voorkomt overselling (order + betaling voor niet-leverbaar).
    if (p.stock <= 0) throw new Error(`${p.name} is uitverkocht`);
    if (qty > p.stock) throw new Error(`${p.name}: nog ${p.stock} op voorraad`);
    const label = item.variantLabel?.trim() || null;
    const sizePrice = variantPrice(p.sizeVariants, label, p.price);
    if (sizePrice === null) throw new Error(`De gekozen maat voor ${p.name} is niet meer beschikbaar`);
    if (!(sizePrice > 0)) throw new Error(`Geen geldige prijs voor ${p.name}`);
    // Nachtkast-toeslag — alleen bij modus "optional" (apart bij te bestellen);
    // prijs komt vers uit de DB (client-bedrag wordt nooit vertrouwd). Max 2.
    // "included" en "none" geven geen toeslag.
    const nk = p.nachtkastMode === "optional" ? Math.max(0, Math.min(2, Math.floor(item.nachtkast ?? 0))) : 0;
    const nkAddon = nk === 1 ? (p.nachtkastPrice ?? 0)
      : nk === 2 ? (p.nachtkastPrice2 ?? (p.nachtkastPrice ?? 0) * 2)
      : 0;
    // Voetbank-toeslag — alleen bij modus "optional", 0/1.
    const vb = p.voetbankMode === "optional" ? Math.max(0, Math.min(1, Math.floor(item.voetbank ?? 0))) : 0;
    const vbAddon = vb * (p.voetbankPrice ?? 0);
    const price = sizePrice + nkAddon + vbAddon;
    const extras = [
      nk > 0 ? `${nk} nachtkast${nk > 1 ? "en" : ""}` : "",
      vb > 0 ? "voetbank" : "",
    ].filter(Boolean).join(" · ");
    const fullLabel = extras ? `${label ?? ""}${label ? " · " : ""}${extras}`.trim() : label;
    lines.push({ productId: p.id, productName: p.name, variantLabel: fullLabel, quantity: qty, price });
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const shipping = isEligibleForFreeShipping(subtotal) ? 0 : shippingInfo.rates.standard;
  const total = subtotal + shipping;
  return { lines, subtotal, shipping, total };
}

/** Uniek, leesbaar ordernummer (MOK-XXXXX-YYY). */
export function generateOrderNumber(now: number): string {
  const stamp = now.toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase().padStart(3, "0");
  return `MOK-${stamp}-${rand}`;
}
