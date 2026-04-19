"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import ProductCard from "./ProductCard";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  images: string;
}

export default function HorizontalScroll({ products }: { products: Product[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
    skipSnaps: false,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const onScroll = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    const progress = Math.max(0, Math.min(1, emblaApi.scrollProgress()));
    setScrollProgress(progress);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onScroll();
    emblaApi.on("scroll", onScroll);
    emblaApi.on("reInit", onScroll);
    return () => {
      emblaApi.off("scroll", onScroll);
      emblaApi.off("reInit", onScroll);
    };
  }, [emblaApi, onScroll]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className="relative">
      {/* Embla viewport */}
      <div className="overflow-hidden cursor-grab active:cursor-grabbing" ref={emblaRef}>
        <div className="flex gap-4 sm:gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 flex-grow-0 basis-[65%] sm:basis-[40%] lg:basis-[28%] xl:basis-[22%]"
            >
              <ProductCard product={product} />
            </div>
          ))}
          <div className="flex-shrink-0 w-6" />
        </div>
      </div>

      {/* Fade aan de rechterkant — hint dat er meer is */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-paper to-transparent hidden lg:block" />

      {/* Controls — progress bar + pijlen */}
      <div className="mt-10 lg:mt-12 max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="flex items-center gap-6 lg:gap-10">
          {/* Progress bar */}
          <div className="flex-1 relative h-[1px] bg-line">
            <div
              className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-150 ease-out"
              style={{ width: `${Math.max(10, scrollProgress * 100)}%` }}
            />
          </div>

          {/* Pijlen */}
          <div className="flex items-center gap-2">
            <button
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              className="w-12 h-12 border border-line flex items-center justify-center text-ink hover:bg-ink hover:text-white hover:border-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink"
              aria-label="Vorige producten"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={scrollNext}
              disabled={!canScrollNext}
              className="w-12 h-12 border border-line flex items-center justify-center text-ink hover:bg-ink hover:text-white hover:border-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink"
              aria-label="Volgende producten"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
