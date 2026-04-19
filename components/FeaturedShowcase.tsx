"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string;
  featured: boolean;
}

export default function FeaturedShowcase({ products }: { products: Product[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setActiveIndex(emblaApi.selectedScrollSnap());
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("scroll", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  if (products.length === 0) return null;

  const active = products[activeIndex] || products[0];
  const activeImages: string[] = JSON.parse(active.images);

  return (
    <section className="py-32 lg:py-48 bg-paper overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-12 lg:mb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-8">
            <p className="eyebrow mb-4">02 — Uitgelicht</p>
            <h2 className="display-lg text-ink">
              Nieuw deze <span className="italic">seizoen</span>
            </h2>
          </div>
          <div className="lg:col-span-4 lg:text-right">
            <Link href="/products" className="btn-link">
              Volledige collectie
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          {/* Groot featured product — links */}
          <motion.div
            key={active.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 lg:sticky lg:top-32"
          >
            <Link href={`/products/${active.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-bone mb-6">
                <motion.div
                  key={active.id}
                  initial={{ scale: 1.05, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={activeImages[0]}
                    alt={active.name}
                    fill
                    className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    priority
                  />
                </motion.div>
                {/* Nummer-indicator */}
                <div className="absolute top-6 left-6 text-white text-[11px] uppercase tracking-[0.3em] mix-blend-difference">
                  {String(activeIndex + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")}
                </div>
              </div>

              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <p className="eyebrow mb-2">{active.category}</p>
                  <h3 className="display-md text-ink group-hover:text-bronze transition-colors leading-tight">
                    {active.name}
                  </h3>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-stone uppercase tracking-[0.2em] mb-1">vanaf</p>
                  <p className="font-serif text-2xl lg:text-3xl text-ink">&euro;{active.price.toFixed(0)}</p>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Product lijst — rechts (desktop) of horizontaal (mobiel) */}
          <div className="lg:col-span-5">
            {/* Desktop: verticale lijst */}
            <div className="hidden lg:block space-y-1">
              {products.map((product, i) => {
                const imgs: string[] = JSON.parse(product.images);
                const isActive = i === activeIndex;
                return (
                  <button
                    key={product.id}
                    onClick={() => setActiveIndex(i)}
                    className={`w-full flex items-center gap-5 py-4 text-left border-b border-line group transition-colors ${
                      isActive ? "border-ink" : ""
                    }`}
                  >
                    <div className={`relative w-20 h-24 flex-shrink-0 overflow-hidden bg-bone transition-all ${isActive ? "opacity-100" : "opacity-50 group-hover:opacity-100"}`}>
                      <Image
                        src={imgs[0]}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-stone uppercase tracking-[0.2em] mb-1">
                        {String(i + 1).padStart(2, "0")}
                      </p>
                      <p className={`font-serif text-lg leading-tight truncate transition-colors ${isActive ? "text-ink" : "text-stone group-hover:text-ink"}`}>
                        {product.name}
                      </p>
                      <p className="text-sm text-stone mt-1">&euro;{product.price.toFixed(0)}</p>
                    </div>
                    <div className={`transition-all ${isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}`}>
                      <div className="w-8 h-[1px] bg-ink" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mobile: horizontale scroll met embla */}
            <div className="lg:hidden">
              <div className="overflow-hidden cursor-grab active:cursor-grabbing" ref={emblaRef}>
                <div className="flex gap-3">
                  {products.map((product, i) => {
                    const imgs: string[] = JSON.parse(product.images);
                    return (
                      <button
                        key={product.id}
                        onClick={() => setActiveIndex(i)}
                        className="flex-shrink-0 basis-[40%] text-left"
                      >
                        <div className={`relative aspect-[3/4] overflow-hidden bg-bone mb-3 transition-opacity ${i === activeIndex ? "opacity-100" : "opacity-50"}`}>
                          <Image src={imgs[0]} alt={product.name} fill className="object-cover" sizes="40vw" />
                        </div>
                        <p className={`text-xs font-serif leading-tight line-clamp-2 ${i === activeIndex ? "text-ink" : "text-stone"}`}>
                          {product.name}
                        </p>
                        <p className="text-[11px] text-stone mt-0.5">&euro;{product.price.toFixed(0)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
