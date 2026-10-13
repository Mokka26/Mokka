"use client";

import Link from "next/link";
import CartItem from "@/components/CartItem";
import AnimatedSection from "@/components/AnimatedSection";
import { useCart, useCartSync } from "@/context/CartContext";
import { shippingInfo, isEligibleForFreeShipping } from "@/lib/shipping-info";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { formatPrice } from "@/components/ui/price";
import { PaymentIconRow } from "@/components/PaymentIcons";
import { deliveryLine } from "@/components/product/deliveryTime";

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
      <AnimatedSection className="mb-12 lg:mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-serif italic text-stone text-base">— 01</span>
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
        <AnimatedSection className="text-center py-24 lg:py-40">
          <h2 className="display-md text-ink mb-6">Je winkelwagen is leeg</h2>
          <p className="body-lg text-slate max-w-md mx-auto mb-12">
            Bekijk de collectie en voeg toe wat je mooi vindt.
          </p>
          <Link href="/products" className="btn-primary min-h-12">
            Bekijk collectie
          </Link>
        </AnimatedSection>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            <AnimatedSection direction="left" className="lg:col-span-8 min-w-0">
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
              <div className="bg-white border border-line rounded-[10px] p-5 sm:p-8 lg:p-10 lg:sticky lg:top-32">
                <h2 className="font-serif text-2xl text-ink mb-6 sm:mb-8">Overzicht</h2>
                <dl className="space-y-4 text-base">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate">Artikelen ({totalItems})</dt>
                    <dd className="text-ink tabular-nums">{formatPrice(totalPrice)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate">Verzending</dt>
                    <dd className="text-ink tabular-nums">{shipping === 0 ? "Gratis" : formatPrice(shipping)}</dd>
                  </div>
                  {!freeShipping && (
                    <div>
                      <dt className="sr-only">Gratis verzending</dt>
                      <dd className="text-[14px] text-ink">
                        Nog <span className="font-medium tabular-nums">{formatPrice(remaining)}</span> tot gratis verzending
                        (vanaf {formatPrice(shippingInfo.freeShippingThreshold)}).
                      </dd>
                    </div>
                  )}
                  <div className="border-t border-line pt-5 flex justify-between items-baseline gap-4">
                    <dt className="text-ink">Totaal</dt>
                    <dd className="font-serif text-2xl text-ink tabular-nums">{formatPrice(total)}</dd>
                  </div>
                </dl>
                <p className="text-[14px] text-stone mt-3">{shippingInfo.vatLabelLong}</p>
                <Link href="/checkout" className="btn-primary w-full min-h-12 text-center mt-8">
                  Afrekenen
                </Link>
                <ul className="mt-6 space-y-1.5 text-[14px] text-slate">
                  <li>{deliveryLine(null)}</li>
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
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center w-full mt-6 min-h-11 text-[14px] text-ink underline underline-offset-4 hover:text-accent transition-colors"
                >
                  Verder winkelen
                </Link>
              </div>
            </AnimatedSection>
          </div>

          {/* Mobiel/tablet: totaal + Afrekenen blijven onderaan in beeld tijdens het scrollen
              door de lijst; sticky (niet fixed) zodat de balk de footer nooit afdekt.
              Onderrand respecteert de iPhone-home-balk (safe-area). */}
          <div className="lg:hidden sticky bottom-0 z-20 mt-8 -mx-6 sm:-mx-10 px-6 sm:px-10 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-paper/95 backdrop-blur-sm border-t border-line">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[14px] text-slate leading-tight">Totaal {shippingInfo.vatLabelShort}</p>
                <p className="font-serif text-2xl text-ink tabular-nums leading-tight">{formatPrice(total)}</p>
              </div>
              <Link href="/checkout" className="btn-primary min-h-12 flex-1 max-w-[14rem] text-center">
                Afrekenen
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
