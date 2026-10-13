"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { trackBeginCheckout, trackViewCart } from "@/lib/analytics";
import { useCart } from "@/context/CartContext";
import { firstImageUrl } from "@/lib/imageHelpers";
import { shippingInfo, isEligibleForFreeShipping } from "@/lib/shipping-info";
import { productUrl } from "@/lib/categories";
import { Drawer, DialogCloseButton } from "@/components/ui/Dialog";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Price, formatPrice } from "@/components/ui/price";
import { PaymentIconRow } from "@/components/PaymentIcons";
import { cartLineDelivery, cartLineOptions } from "@/components/CartItem";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CART_DRAWER_ID = "cart-drawer";

// Voortgangsbalk in stappen van 10% — statische klassen i.p.v. inline width.
const PROGRESS_WIDTH = [
  "w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]",
  "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full",
] as const;

/**
 * Winkelwagen-drawer op het native <dialog>-element (Drawer uit components/ui):
 * focus blijft in de drawer, de rest van de pagina is inert, Esc sluit, focus
 * gaat terug naar de winkelwagen-knop.
 */
export default function CartDrawer({ open, onClose }: Props) {
  const { items, totalItems, totalPrice, removeWithUndo, updateQuantity } = useCart();
  const freeShipping = isEligibleForFreeShipping(totalPrice);
  const shipping = freeShipping ? 0 : shippingInfo.rates.standard;
  const total = totalPrice + shipping;
  const remaining = Math.max(0, shippingInfo.freeShippingThreshold - totalPrice);
  const progress = Math.min(100, Math.round((totalPrice / shippingInfo.freeShippingThreshold) * 100));

  // GA4 view_cart bij het openen van de drawer (niet bij elke wijziging erin).
  useEffect(() => {
    if (open) trackViewCart(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen bij openen
  }, [open]);

  return (
    <Drawer
      id={CART_DRAWER_ID}
      side="right"
      open={open}
      onClose={onClose}
      title="Winkelwagen"
      className="w-full sm:w-[460px] bg-white"
      header={
        <div className="flex items-center justify-between gap-4 px-6 lg:px-8 min-h-16 border-b border-line shrink-0">
          <h2 className="font-serif text-xl text-ink">
            Winkelwagen
            {totalItems > 0 && (
              <span className="text-stone text-base font-sans ml-2">
                ({totalItems} {totalItems === 1 ? "artikel" : "artikelen"})
              </span>
            )}
          </h2>
          <DialogCloseButton onClick={onClose} label="Winkelwagen sluiten" />
        </div>
      }
      footer={
        items.length > 0 ? (
          // Compact op kleine schermen (iPhone SE: 667px hoog): geen voortgangsbalk
          // en geen betaaliconen onder `sm`, wel safe-area onderaan.
          <div className="px-6 lg:px-8 py-4 sm:py-5 space-y-3 sm:space-y-4 bg-paper pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="space-y-1.5 sm:space-y-2 text-base">
              <div className="flex justify-between text-slate">
                <span>Subtotaal</span>
                <span className="text-ink tabular-nums">{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-slate">
                <span>Verzending</span>
                <span className="text-ink tabular-nums">{shipping === 0 ? "Gratis" : formatPrice(shipping)}</span>
              </div>
            </div>

            {!freeShipping && (
              <div className="space-y-1.5">
                <p className="text-[14px] text-ink">
                  Nog <span className="font-medium tabular-nums">{formatPrice(remaining)}</span> tot gratis verzending
                </p>
                <div
                  role="progressbar"
                  aria-label="Voortgang naar gratis verzending"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="hidden sm:block h-1 w-full bg-line rounded-full overflow-hidden"
                >
                  <div className={`h-full bg-accent rounded-full transition-[width] duration-[480ms] ${PROGRESS_WIDTH[Math.floor(progress / 10)]}`} />
                </div>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-3 border-t border-line">
              <span className="text-base text-ink">Totaal <span className="text-stone text-[14px]">({shippingInfo.vatLabelShort})</span></span>
              <span className="font-serif text-2xl text-ink tabular-nums">{formatPrice(total)}</span>
            </div>

            <div className="space-y-3 pt-1">
              <Link
                href="/checkout"
                onClick={() => {
                  trackBeginCheckout(items, totalPrice);
                  onClose();
                }}
                className="btn-primary w-full text-center block"
              >
                Afrekenen
              </Link>
              <Link href="/cart" onClick={onClose} className="btn-ghost w-full text-center block">
                Bekijk winkelwagen
              </Link>
            </div>
            <div className="hidden sm:block">
              <PaymentIconRow className="justify-center pt-1" />
            </div>
          </div>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="h-full min-h-[50dvh] flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 border border-line rounded-full flex items-center justify-center mb-8">
            <ShoppingBag className="w-6 h-6 text-stone" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h3 className="font-serif text-2xl text-ink mb-3">Je winkelwagen is leeg</h3>
          <p className="text-slate text-base mb-10 max-w-xs">
            Bekijk de collectie en voeg toe wat je mooi vindt.
          </p>
          <button type="button" onClick={onClose} className="btn-ghost">
            Verder winkelen
          </button>
        </div>
      ) : (
        <ul className="px-6 lg:px-8 py-6 space-y-6">
          {items.map((item) => {
            const thumb = firstImageUrl(item.product.images);
            const options = cartLineOptions(item);
            const maxQty = item.product.stock != null && item.product.stock > 0 ? Math.min(99, item.product.stock) : 99;
            return (
              <li key={item.lineKey} className="flex gap-4">
                <Link
                  href={productUrl(item.product)}
                  onClick={onClose}
                  className="relative w-20 h-20 shrink-0 overflow-hidden bg-bone rounded-[8px]"
                  aria-label={`Bekijk ${item.product.name}`}
                >
                  {thumb && <Image src={thumb} alt="" fill className="object-contain" sizes="80px" />}
                </Link>

                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <h3 className="font-serif text-base text-ink leading-tight">
                    <Link href={productUrl(item.product)} onClick={onClose} className="inline-block py-1 hover:text-accent transition-colors">
                      {item.product.name}
                    </Link>
                  </h3>
                  {options.length > 0 && <p className="text-[14px] text-stone">{options.join(" · ")}</p>}
                  <p className="text-[14px] text-stone">{cartLineDelivery(item)}</p>
                  <Price price={item.product.price} size="sm" className="!text-base" />

                  <div className="flex items-center justify-between gap-3 mt-2">
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(q) => updateQuantity(item.lineKey, q)}
                      name={item.product.name}
                      max={maxQty}
                    />
                    <button
                      type="button"
                      onClick={() => removeWithUndo(item.lineKey)}
                      className="inline-flex items-center min-h-11 px-2 -mr-2 text-[14px] text-stone underline underline-offset-4 hover:text-error transition-colors"
                    >
                      Verwijderen<span className="sr-only">: {item.product.name}</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
