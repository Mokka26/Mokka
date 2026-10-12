"use client";

import Link from "next/link";
import CartItem from "@/components/CartItem";
import AnimatedSection from "@/components/AnimatedSection";
import { useCart, useCartSync } from "@/context/CartContext";
import { shippingInfo, isEligibleForFreeShipping } from "@/lib/shipping-info";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { formatPrice } from "@/components/ui/price";
import { PaymentIconRow } from "@/components/PaymentIcons";

export default function CartPage() {
  const { items, totalPrice, totalItems } = useCart();
  // Prijzen/voorraad verversen tegen de server (meldingen via toasts).
  useCartSync();

  const freeShipping = isEligibleForFreeShipping(totalPrice);
  const shipping = freeShipping ? 0 : shippingInfo.rates.standard;
  const total = totalPrice + shipping;
  const remaining = Math.max(0, shippingInfo.freeShippingThreshold - totalPrice);
  const phoneLink = getPhoneLink();

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-32 lg:pt-40 pb-28 lg:pb-40">
      {/* Editorial header */}
      <AnimatedSection className="mb-16 lg:mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-serif italic text-stone text-sm">— 01</span>
              <span className="eyebrow">Jouw selectie</span>
            </div>
            <h1 className="display-lg text-ink">Winkelwagen</h1>
          </div>
          {items.length > 0 && (
            <div className="lg:col-span-4">
              <p className="body-lg text-slate max-w-md">
                {totalItems} {totalItems === 1 ? "artikel" : "artikelen"} in je winkelwagen.
              </p>
            </div>
          )}
        </div>
      </AnimatedSection>

      {items.length === 0 ? (
        <AnimatedSection className="text-center py-32 lg:py-40">
          <h2 className="display-md text-ink mb-6">Je winkelwagen is leeg</h2>
          <p className="body-lg text-slate max-w-md mx-auto mb-12">
            Bekijk de collectie en voeg toe wat je mooi vindt.
          </p>
          <Link href="/products" className="btn-primary">
            Bekijk collectie
          </Link>
        </AnimatedSection>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <AnimatedSection direction="left" className="lg:col-span-8">
            <div className="border-b border-line pb-5 mb-2 hidden md:grid grid-cols-12 gap-4 eyebrow-lg">
              <div className="col-span-6">Product</div>
              <div className="col-span-2 text-center">Aantal</div>
              <div className="col-span-2 text-right">Prijs</div>
              <div className="col-span-2 text-right">Totaal</div>
            </div>
            {items.map((item) => (
              <CartItem key={item.lineKey} item={item} />
            ))}
          </AnimatedSection>

          <AnimatedSection direction="right" className="lg:col-span-4">
            <div className="bg-white border border-line rounded-[10px] p-8 lg:p-10 sticky top-32">
              <h2 className="font-serif text-2xl text-ink mb-8">Overzicht</h2>
              <div className="space-y-4 text-base">
                <div className="flex justify-between">
                  <span className="text-slate">Artikelen ({totalItems})</span>
                  <span className="text-ink tabular-nums">{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Verzending</span>
                  <span className="text-ink tabular-nums">{shipping === 0 ? "Gratis" : formatPrice(shipping)}</span>
                </div>
                {!freeShipping && (
                  <p className="text-sm text-ink">
                    Nog <span className="font-medium tabular-nums">{formatPrice(remaining)}</span> tot gratis verzending
                    (vanaf {formatPrice(shippingInfo.freeShippingThreshold)}).
                  </p>
                )}
                <div className="border-t border-line pt-5 flex justify-between items-baseline">
                  <span className="text-ink">Totaal</span>
                  <span className="font-serif text-2xl text-ink tabular-nums">{formatPrice(total)}</span>
                </div>
                <p className="text-sm text-stone">{shippingInfo.vatLabelLong}</p>
              </div>
              <Link href="/checkout" className="btn-primary w-full text-center block mt-8">
                Afrekenen
              </Link>
              <ul className="mt-6 space-y-1.5 text-sm text-slate">
                <li>Levertijd {shippingInfo.deliveryTime.inStock}</li>
                <li>
                  {shippingInfo.returnWindowDays} dagen bedenktijd —{" "}
                  <Link href={businessInfo.legal.returnPolicyUrl} className="underline underline-offset-4 hover:text-accent">
                    zo werkt retourneren
                  </Link>
                </li>
                {phoneLink && businessInfo.contact.phoneFormatted && (
                  <li>
                    Vragen? Bel{" "}
                    <a href={phoneLink} className="underline underline-offset-4 hover:text-accent whitespace-nowrap">
                      {businessInfo.contact.phoneFormatted}
                    </a>
                  </li>
                )}
              </ul>
              <PaymentIconRow className="mt-6" />
              <Link href="/products" className="block text-center mt-6 min-h-11 leading-[44px] text-sm text-ink underline underline-offset-4 hover:text-accent transition-colors">
                Verder winkelen
              </Link>
            </div>
          </AnimatedSection>
        </div>
      )}
    </div>
  );
}
