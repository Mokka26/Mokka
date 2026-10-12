"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { priceLine } from "@/lib/orders";
import { firstImageUrl } from "@/lib/imageHelpers";
import { captureError } from "@/lib/sentry";

/**
 * Cart-synchronisatie. De winkelwagen leeft client-side (localStorage) met de
 * prijs van het moment van toevoegen. Vóór het tonen van de cart/checkout
 * haalt de UI hiermee de ACTUELE stand op (prijs incl. maat/opties, voorraad,
 * zichtbaarheid) en werkt de regels bij — zodat createCheckout niet op
 * PRICE_CHANGED hoeft te weigeren.
 */

const itemSchema = z
  .object({
    productId: z.string().min(1).max(64).optional(),
    slug: z.string().min(1).max(160).optional(),
    variantLabel: z.string().max(60).nullable().optional(),
    nachtkast: z.number().int().min(0).max(2).optional(),
    voetbank: z.number().int().min(0).max(1).optional(),
  })
  .refine((i) => !!i.productId || !!i.slug, { message: "productId of slug is verplicht" });

const inputSchema = z.array(itemSchema).max(50);

export type CartSnapshotInput = z.input<typeof inputSchema>;

export type CartSnapshotLine = {
  /** Zoals meegestuurd — om de regel in de client terug te vinden. */
  key: { productId?: string; slug?: string; variantLabel: string | null; nachtkast: number; voetbank: number };
  /** false = product bestaat niet (meer), is verborgen of verwijderd → regel verwijderen. */
  available: boolean;
  hidden: boolean;
  deleted: boolean;
  /** false = de gekozen maat bestaat niet meer → klant moet opnieuw kiezen. */
  variantValid: boolean;
  productId: string | null;
  slug: string | null;
  name: string | null;
  category: string | null;
  image: string | null;
  /** Actuele regel-stukprijs in euro's (maat + nachtkast + voetbank). null als niet prijsbaar. */
  price: number | null;
  /** Basisprijs van het product (zonder maat/opties). */
  basePrice: number | null;
  listPrice: number | null;
  stock: number;
  /** Samengesteld label voor weergave (bv. "160 × 200 · 2 nachtkasten"). */
  label: string | null;
};

/**
 * `getCartSnapshot(items)` → actuele prijs/voorraad/zichtbaarheid per regel,
 * in dezelfde volgorde als de input. Verborgen of verwijderde producten komen
 * terug met available:false (nooit met prijs), zodat de UI de regel kan
 * verwijderen of markeren.
 */
export async function getCartSnapshot(items: CartSnapshotInput): Promise<CartSnapshotLine[]> {
  const parsed = inputSchema.safeParse(items);
  if (!parsed.success) return [];
  const input = parsed.data;
  if (input.length === 0) return [];

  const ids = [...new Set(input.flatMap((i) => (i.productId ? [i.productId] : [])))];
  const slugs = [...new Set(input.flatMap((i) => (!i.productId && i.slug ? [i.slug] : [])))];

  let products: Array<{
    id: string; slug: string; name: string; category: string; images: string; price: number; listPrice: number | null;
    stock: number; hidden: boolean; deletedAt: Date | null; sizeVariants: string | null;
    nachtkastMode: string | null; nachtkastPrice: number | null; nachtkastPrice2: number | null;
    voetbankMode: string | null; voetbankPrice: number | null;
  }>;
  try {
    products = await prisma.product.findMany({
      where: { OR: [...(ids.length ? [{ id: { in: ids } }] : []), ...(slugs.length ? [{ slug: { in: slugs } }] : [])] },
      select: {
        id: true, slug: true, name: true, category: true, images: true, price: true, listPrice: true,
        stock: true, hidden: true, deletedAt: true, sizeVariants: true,
        nachtkastMode: true, nachtkastPrice: true, nachtkastPrice2: true, voetbankMode: true, voetbankPrice: true,
      },
    });
  } catch (e) {
    captureError(e, { scope: "getCartSnapshot", count: input.length });
    return [];
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  return input.map((i) => {
    const key = {
      ...(i.productId ? { productId: i.productId } : {}),
      ...(i.slug ? { slug: i.slug } : {}),
      variantLabel: i.variantLabel ?? null,
      nachtkast: i.nachtkast ?? 0,
      voetbank: i.voetbank ?? 0,
    };
    const p = (i.productId ? byId.get(i.productId) : undefined) ?? (i.slug ? bySlug.get(i.slug) : undefined);
    const empty: CartSnapshotLine = {
      key, available: false, hidden: false, deleted: false, variantValid: false,
      productId: null, slug: null, name: null, category: null, image: null,
      price: null, basePrice: null, listPrice: null, stock: 0, label: null,
    };
    if (!p) return empty;

    const deleted = p.deletedAt !== null;
    const available = !p.hidden && !deleted;
    const base = { ...empty, productId: p.id, slug: p.slug, name: p.name, category: p.category, image: firstImageUrl(p.images), hidden: p.hidden, deleted, stock: p.stock };
    if (!available) return base;

    const priced = priceLine(p, i);
    if (!priced.ok) return { ...base, available: true, variantValid: false, basePrice: p.price, listPrice: p.listPrice };
    return {
      ...base,
      available: true,
      variantValid: true,
      price: priced.unitCents / 100,
      basePrice: p.price,
      listPrice: p.listPrice,
      label: priced.fullLabel,
    };
  });
}
