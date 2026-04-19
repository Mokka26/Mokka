"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const categories = [
  { number: "01", name: "Banken", slug: "banken", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1400&q=90", description: "Het hart van elke woonkamer. Comfort met karakter." },
  { number: "02", name: "Tafels", slug: "tafels", image: "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=1400&q=90", description: "Om de tafel wordt geleefd. Eiken, marmer, ambacht." },
  { number: "03", name: "Stoelen", slug: "stoelen", image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=1400&q=90", description: "Comfort als sculptuur. Stoelen die een statement maken." },
  { number: "04", name: "Slaapkamers", slug: "slaapkamers", image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1400&q=90", description: "Waar rust begint. Zachte materialen, warme tinten." },
  { number: "05", name: "Kasten", slug: "kasten", image: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1400&q=90", description: "Meer dan opbergruimte. Kasten als architectuur." },
];

export default function CategoriesShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = categories[activeIndex];

  return (
    <section className="py-32 lg:py-48 bg-white overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-14 lg:mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-8">
            <p className="eyebrow mb-4">03 — Collectie</p>
            <h2 className="display-lg text-ink">
              Ontdek per <span className="italic">categorie</span>
            </h2>
          </div>
          <div className="lg:col-span-4 lg:text-right">
            <Link href="/products" className="btn-link">
              Alle categorieën
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start">
          {/* Grote actieve foto — links */}
          <div className="lg:col-span-7 relative aspect-[4/5] lg:aspect-[4/5] overflow-hidden bg-bone order-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.slug}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
                className="absolute inset-0"
              >
                <Image
                  src={active.image}
                  alt={active.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  priority
                />
              </motion.div>
            </AnimatePresence>

            {/* Overlay met nummer */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-6 left-6 lg:top-8 lg:left-8 text-white text-[11px] uppercase tracking-[0.3em]">
              {active.number} / 05
            </div>

            {/* Tekst + CTA onderaan foto */}
            <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`info-${active.slug}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="flex items-end justify-between gap-6"
                >
                  <div className="max-w-md">
                    <h3 className="font-serif text-white text-3xl sm:text-4xl lg:text-5xl leading-[1.05] mb-2">
                      {active.name}
                    </h3>
                    <p className="text-white/70 text-sm max-w-sm hidden sm:block">{active.description}</p>
                  </div>
                  <Link
                    href={`/products?category=${active.slug}`}
                    className="flex-shrink-0 w-12 h-12 lg:w-14 lg:h-14 bg-white text-ink flex items-center justify-center hover:bg-bronze hover:text-white transition-colors"
                    aria-label={`Bekijk ${active.name}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                    </svg>
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Categorieën lijst — rechts */}
          <div className="lg:col-span-5 order-2">
            <ul>
              {categories.map((cat, i) => {
                const isActive = i === activeIndex;
                return (
                  <li key={cat.slug}>
                    <button
                      onMouseEnter={() => setActiveIndex(i)}
                      onFocus={() => setActiveIndex(i)}
                      onClick={() => setActiveIndex(i)}
                      className={`w-full group relative flex items-center gap-5 py-5 lg:py-7 text-left border-b transition-colors ${
                        isActive ? "border-ink" : "border-line"
                      }`}
                    >
                      {/* Nummer */}
                      <span className={`text-[11px] uppercase tracking-[0.25em] transition-colors ${isActive ? "text-ink" : "text-stone"}`}>
                        {cat.number}
                      </span>

                      {/* Naam */}
                      <span className={`flex-1 font-serif text-2xl sm:text-3xl lg:text-4xl transition-colors ${isActive ? "text-ink italic" : "text-stone/70 group-hover:text-ink"}`}>
                        {cat.name}
                      </span>

                      {/* Pijl die verschijnt bij actief */}
                      <motion.span
                        animate={{
                          opacity: isActive ? 1 : 0,
                          x: isActive ? 0 : -10,
                        }}
                        transition={{ duration: 0.3 }}
                        className="flex-shrink-0"
                      >
                        <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                        </svg>
                      </motion.span>

                      {/* Onderlijn reveal indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="categoryUnderline"
                          className="absolute left-0 right-0 bottom-0 h-[2px] bg-ink"
                          transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
