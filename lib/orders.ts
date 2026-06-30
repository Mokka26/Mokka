import { prisma } from "@/lib/prisma";
import { shippingInfo, isEligibleForFreeShipping } from "@/lib/shipping-info";

export type CheckoutLineInput = {
  productId: string;
  variantLabel?: string | null;
  nachtkast?: number;
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

function variantPrice(sizeVariants: string | null, label: string | null, fallback: number): number {
  if (!label || !sizeVariants) return fallback;
  try {
    const arr = JSON.parse(sizeVariants) as SizeVariant[];
    const match = Array.isArray(arr) ? arr.find((v) => v.label === label) : null;
    return match && typeof match.price === "number" && match.price > 0 ? match.price : fallback;
  } catch {
    return fallback;
  }
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
    select: { id: true, name: true, price: true, sizeVariants: true, nachtkastPrice: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: ComputedLine[] = [];
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) throw new Error("Product niet (meer) beschikbaar");
    const qty = Math.max(1, Math.min(99, Math.floor(item.quantity)));
    const label = item.variantLabel?.trim() || null;
    const sizePrice = variantPrice(p.sizeVariants, label, p.price);
    if (!(sizePrice > 0)) throw new Error(`Geen geldige prijs voor ${p.name}`);
    // Nachtkast-toeslag — alleen als het bed een nachtkast-prijs heeft; prijs
    // komt vers uit de DB (client-bedrag wordt nooit vertrouwd). Max 2.
    const nkUnit = p.nachtkastPrice ?? 0;
    const nk = nkUnit > 0 ? Math.max(0, Math.min(2, Math.floor(item.nachtkast ?? 0))) : 0;
    const price = sizePrice + nk * nkUnit;
    const fullLabel = nk > 0 ? `${label ?? ""}${label ? " · " : ""}${nk} nachtkast${nk > 1 ? "en" : ""}`.trim() : label;
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
