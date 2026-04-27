"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import CartItem from "@/components/CartItem";
import AnimatedSection from "@/components/AnimatedSection";
import { useCart } from "@/context/CartContext";

export default function CartPage() {
  const { items, totalPrice, totalItems } = useCart();
  const shipping = totalPrice >= 100 ? 0 : 9.95;
  const total = totalPrice + shipping;

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-32 lg:pt-40 pb-28 lg:pb-40">
      {/* Editorial header */}
      <AnimatedSection className="mb-16 lg:mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-serif italic text-stone text-sm">— 01</span>
              <span className="eyebrow">Jouw Selectie</span>
            </div>
            <h1 className="display-lg text-ink">
              Winkelwagen
            </h1>
          </div>
          {items.length > 0 && (
            <div className="lg:col-span-4">
              <p className="body-lg text-slate max-w-md">
                {totalItems} {totalItems === 1 ? "artikel" : "artikelen"} in je selectie, klaar om af te ronden.
              </p>
            </div>
          )}
        </div>
      </AnimatedSection>

      {items.length === 0 ? (
        <AnimatedSection className="text-center py-32 lg:py-40">
          <p className="eyebrow mb-8">Leeg</p>
          <h2 className="display-md text-ink mb-6">Je winkelwagen is leeg</h2>
          <p className="body-lg text-slate max-w-md mx-auto mb-12">
            Ontdek onze collectie en voeg je favorieten toe.
          </p>
          <Link href="/products" className="btn-primary">
            Bekijk Collectie
          </Link>
        </AnimatedSection>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <AnimatedSection direction="left" className="lg:col-span-8">
            <div className="border-b border-line pb-5 mb-6 hidden md:grid grid-cols-12 gap-4">
              <div className="col-span-6 eyebrow">Product</div>
              <div className="col-span-2 eyebrow text-center">Aantal</div>
              <div className="col-span-2 eyebrow text-right">Prijs</div>
              <div className="col-span-2 eyebrow text-right">Totaal</div>
            </div>
            {items.map((item, i) => (
              <motion.div key={item.productId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <CartItem item={item} />
              </motion.div>
            ))}
          </AnimatedSection>

          <AnimatedSection direction="right" className="lg:col-span-4">
            <div className="bg-white border border-line p-8 lg:p-10 sticky top-32">
              <span className="eyebrow">Overzicht</span>
              <h3 className="font-serif text-2xl text-ink mt-3 mb-8">Jouw bestelling</h3>
              <div className="space-y-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate">Artikelen ({totalItems})</span>
                  <span className="text-ink">&euro;{totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Verzending</span>
                  <span className="text-ink">{shipping === 0 ? "Gratis" : `\u20AC${shipping.toFixed(2)}`}</span>
                </div>
                {shipping > 0 && (
                  <p className="text-[11px] text-stone uppercase tracking-[0.2em]">Gratis verzending vanaf &euro;100</p>
                )}
                <div className="border-t border-line pt-5 flex justify-between items-baseline">
                  <span className="eyebrow">Totaal</span>
                  <span className="font-serif text-2xl text-ink">&euro;{total.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-stone uppercase tracking-[0.2em]">Inclusief 21% BTW</p>
              </div>
              <Link href="/checkout" className="btn-primary w-full text-center block mt-8">
                Afrekenen
              </Link>
              <Link href="/products" className="block text-center mt-6">
                <span className="eyebrow hover:text-bronze transition-colors">Verder Winkelen</span>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      )}
    </div>
  );
}
