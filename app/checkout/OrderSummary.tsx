"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import type { CartItemType } from "@/context/CartContext";
import { frameMode, parseImages } from "@/lib/imageHelpers";
import { cldOptimize } from "@/lib/cloudinary-url";
import { shippingInfo } from "@/lib/shipping-info";
import { Price, formatPrice } from "@/components/ui/price";
import { cartLineOptions, cartLineDelivery } from "@/components/CartItem";

type Totals = {
  subtotal: number;
  shipping: number;
  total: number;
};

/**
 * Regels + totalen van de bestelling. Wordt twee keer gebruikt in de checkout:
 * in de inklapbare samenvatting bóven het formulier (< lg) en in de vaste
 * kaart naast het formulier (lg+). Eén bron, dus altijd dezelfde bedragen.
 */
export function OrderSummaryLines({ items, totals }: { items: CartItemType[]; totals: Totals }) {
  return (
    <>
      <ul className="space-y-5 mb-6">
        {items.map((item) => {
          const thumbImage = parseImages(item.product.images)[0];
          const thumb = thumbImage ? cldOptimize(thumbImage.url, { ar: "1:1", mode: frameMode(thumbImage), w: 160 }) : null;
          const options = cartLineOptions(item);
          return (
            <li key={item.lineKey} className="flex gap-4">
              <div className="relative w-20 h-20 bg-bone rounded-[8px] shrink-0 overflow-hidden">
                {thumb && <Image src={thumb} alt="" fill unoptimized sizes="80px" className="object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ink text-base font-medium leading-snug">{item.product.name}</p>
                {options.length > 0 && <p className="text-stone text-[14px] mt-0.5">{options.join(" · ")}</p>}
                <p className="text-stone text-[14px] mt-0.5">Aantal: {item.quantity}</p>
                <p className="text-stone text-[14px] mt-0.5">{cartLineDelivery(item)}</p>
                <Price price={item.product.price * item.quantity} size="sm" className="!text-base mt-1" />
              </div>
            </li>
          );
        })}
      </ul>
      <dl className="border-t border-line pt-5 space-y-4 text-base">
        <div className="flex justify-between gap-4">
          <dt className="text-slate">Subtotaal</dt>
          <dd className="text-ink tabular-nums">{formatPrice(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate">Verzending</dt>
          <dd className="text-ink tabular-nums">{totals.shipping === 0 ? "Gratis" : formatPrice(totals.shipping)}</dd>
        </div>
        <div className="border-t border-line pt-5 flex justify-between items-baseline gap-4">
          <dt className="text-ink">Totaal</dt>
          <dd className="font-serif text-2xl text-ink tabular-nums">{formatPrice(totals.total)}</dd>
        </div>
      </dl>
      <p className="text-[14px] text-stone mt-3">{shippingInfo.vatLabelLong}</p>
    </>
  );
}

/**
 * Inklapbare samenvatting voor mobiel/tablet (< lg): "Je bestelling (N)" met
 * het totaal altijd zichtbaar, de regels na een tik. Native <details>, dus
 * toetsenbord en screenreader werken zonder extra JavaScript.
 */
export function MobileOrderSummary({ items, totals }: { items: CartItemType[]; totals: Totals }) {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <details className="lg:hidden group bg-white border border-line rounded-[10px] mb-8">
      <summary className="flex items-center justify-between gap-4 px-5 sm:px-8 py-4 min-h-14 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-base text-ink">
        <span className="font-medium">
          Je bestelling ({count})
          <span className="sr-only"> — totaal</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="font-serif text-xl tabular-nums">{formatPrice(totals.total)}</span>
          <ChevronDown
            className="w-5 h-5 text-stone transition-transform duration-200 group-open:rotate-180"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="px-5 sm:px-8 pb-5 sm:pb-8 pt-5 border-t border-line">
        <OrderSummaryLines items={items} totals={totals} />
      </div>
    </details>
  );
}
