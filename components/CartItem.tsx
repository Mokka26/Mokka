"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart, type CartItemType } from "@/context/CartContext";
import { firstImageUrl } from "@/lib/imageHelpers";
import { productUrl } from "@/lib/categories";
import { Price, formatPrice } from "@/components/ui/price";
import { deliveryLine } from "@/components/product/deliveryTime";
import { QuantityStepper } from "@/components/ui/QuantityStepper";

interface Props {
  item: CartItemType;
}

/** Korte opties-regel: maat · nachtkasten · voetbank. */
export function cartLineOptions(item: CartItemType): string[] {
  const parts: string[] = [];
  if (item.variantLabel) parts.push(`Maat ${item.variantLabel}`);
  if (item.nachtkast > 0) parts.push(`${item.nachtkast} nachtkast${item.nachtkast > 1 ? "en" : ""}`);
  if (item.voetbank > 0) parts.push("Voetbank");
  return parts;
}

/** "Levertijd: binnen 5 werkdagen" — zelfde helper als ProductCard en PDP. */
export function cartLineDelivery(item: CartItemType): string {
  return deliveryLine(item.product.deliveryTime);
}

export default function CartItem({ item }: Props) {
  const { removeWithUndo, updateQuantity } = useCart();
  const thumb = firstImageUrl(item.product.images);
  const itemTotal = item.product.price * item.quantity;
  const options = cartLineOptions(item);
  const maxQty = item.product.stock != null && item.product.stock > 0 ? Math.min(99, item.product.stock) : 99;

  return (
    <div className="grid grid-cols-12 gap-x-4 gap-y-4 items-center py-6 border-b border-line">
      <div className="col-span-12 md:col-span-6 flex gap-5">
        <Link
          href={productUrl(item.product)}
          className="relative w-24 h-24 bg-bone rounded-[8px] shrink-0 overflow-hidden"
          aria-label={`Bekijk ${item.product.name}`}
        >
          {thumb && (
            <Image src={thumb} alt="" fill className="object-contain" sizes="96px" />
          )}
        </Link>
        <div className="min-w-0">
          <h3 className="text-ink text-base font-medium leading-snug">
            <Link href={productUrl(item.product)} className="hover:text-accent transition-colors">
              {item.product.name}
            </Link>
          </h3>
          {options.length > 0 && (
            <p className="text-stone text-sm mt-1">{options.join(" · ")}</p>
          )}
          <p className="text-stone text-sm mt-1">{cartLineDelivery(item)}</p>
          <button
            type="button"
            onClick={() => removeWithUndo(item.lineKey)}
            className="inline-flex items-center min-h-11 -ml-2 px-2 text-sm text-stone underline underline-offset-4 hover:text-error transition-colors"
          >
            Verwijderen<span className="sr-only">: {item.product.name}</span>
          </button>
        </div>
      </div>
      <div className="col-span-5 md:col-span-2 flex items-center md:justify-center">
        <QuantityStepper
          value={item.quantity}
          onChange={(q) => updateQuantity(item.lineKey, q)}
          name={item.product.name}
          max={maxQty}
        />
      </div>
      <div className="col-span-3 md:col-span-2 text-right">
        <span className="md:hidden sr-only">Stukprijs: </span>
        <Price price={item.product.price} size="sm" className="!text-base text-stone font-sans" />
      </div>
      <div className="col-span-4 md:col-span-2 text-right text-ink text-base font-medium tabular-nums">
        <span className="sr-only">Regeltotaal: </span>
        {formatPrice(itemTotal)}
      </div>
    </div>
  );
}
