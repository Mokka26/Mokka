"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import CartItem from "@/components/CartItem";
import AnimatedSection from "@/components/AnimatedSection";
import { useCart } from "@/context/CartContext";

export default function CartPage() {
  const { items, totalPrice, totalItems } = useCart();
  const shipping = totalPrice >= 100 ? 0 : 9.95;
  const total = totalPrice + shipping;

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-32 pb-20">
      <AnimatedSection className="mb-10">
        <p className="eyebrow">Jouw Selectie</p>
        <h1 className="display-md text-ink">Winkelwagen</h1>
      </AnimatedSection>

      {items.length === 0 ? (
        <AnimatedSection className="text-center py-20">
          <svg className="w-16 h-16 text-bone mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <p className="text-stone text-lg font-light mb-2">Je winkelwagen is leeg</p>
          <p className="text-stone text-sm mb-8">Ontdek onze collectie en voeg je favorieten toe.</p>
          <Link href="/products" className="btn-primary">
            Bekijk Collectie
          </Link>
        </AnimatedSection>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <AnimatedSection direction="left" className="lg:col-span-2">
            <div className="border-b border-line pb-4 mb-4 hidden md:grid grid-cols-12 gap-4 text-[10px] text-stone uppercase tracking-[0.2em]">
              <div className="col-span-6">Product</div>
              <div className="col-span-2 text-center">Aantal</div>
              <div className="col-span-2 text-right">Prijs</div>
              <div className="col-span-2 text-right">Totaal</div>
            </div>
            {items.map((item, i) => (
              <motion.div key={item.productId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <CartItem item={item} />
              </motion.div>
            ))}
          </AnimatedSection>

          <AnimatedSection direction="right" className="lg:col-span-1">
            <div className="bg-white border border-line p-8 sticky top-28">
              <h3 className="font-serif text-xl text-ink mb-6">Overzicht</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone">Artikelen ({totalItems})</span>
                  <span className="text-ink">&euro;{totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone">Verzending</span>
                  <span className="text-ink">{shipping === 0 ? "Gratis" : `\u20AC${shipping.toFixed(2)}`}</span>
                </div>
                {shipping > 0 && (
                  <p className="text-[10px] text-stone">Gratis verzending vanaf &euro;100</p>
                )}
                <div className="border-t border-line pt-4 flex justify-between font-medium text-base">
                  <span className="text-ink">Totaal</span>
                  <span className="text-ink">&euro;{total.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-stone">Inclusief 21% BTW</p>
              </div>
              <Link href="/checkout" className="btn-primary w-full text-center block mt-6">
                Afrekenen
              </Link>
              <Link href="/products" className="block text-center text-stone text-xs mt-4 hover:text-bronze transition-colors uppercase tracking-wider">
                Verder Winkelen
              </Link>
            </div>
          </AnimatedSection>
        </div>
      )}
    </div>
  );
}
