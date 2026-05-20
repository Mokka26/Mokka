"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowUpRight, ArrowLeft, ArrowRight } from "lucide-react";
import { firstImageUrl } from "@/lib/imageHelpers";
import { cldOptimize } from "@/lib/cloudinary-url";
import { useReveal } from "@/hooks/useReveal";
import { productUrl } from "@/lib/categories";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string;
}

interface Props {
  products: Product[];
}

export default function LookbookClient({ products }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const total = products.length;

  const scrollToFrame = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const frame = scroller.children[index] as HTMLElement | undefined;
    if (!frame) return;
    scroller.scrollTo({ left: frame.offsetLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frameId: number;
    const handleScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const center = scroller.scrollLeft + scroller.clientWidth / 2;
        let closest = 0;
        let closestDistance = Infinity;
        for (let i = 0; i < scroller.children.length; i++) {
          const child = scroller.children[i] as HTMLElement;
          const childCenter = child.offsetLeft + child.clientWidth / 2;
          const distance = Math.abs(childCenter - center);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = i;
          }
        }
        setActiveIndex(closest);
      });
    };
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(frameId);
    };
  }, [total]);

  if (total === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center pt-32 px-6 text-center">
        <div>
          <p className="eyebrow mb-4">Lookbook</p>
          <h1 className="display-md text-ink mb-4">Binnenkort</h1>
          <p className="text-stone max-w-md mx-auto">De editorial collectie is in voorbereiding. Kom binnenkort terug.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-paper">
      {/* Intro header — contained */}
      <header className="pt-32 lg:pt-40 pb-12 lg:pb-16 max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow text-accent mb-5">— Lookbook · Voorjaar 2026</p>
            <h1 className="display-md text-ink" style={{ fontVariationSettings: '"opsz" 144' }}>
              Stukken in <span className="italic text-accent">context</span>.
            </h1>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-stone text-base lg:text-lg leading-[1.6] max-w-[42ch]">
              Scroll horizontaal door de uitgelichte stukken. Elk frame is een editorial blik &mdash; van textuur tot context.
            </p>
          </div>
        </div>
      </header>

      {/* Horizontal scroll-snap scroller */}
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-20 lg:pb-28"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollPaddingLeft: "0px" }}
        >
          {products.map((product, i) => (
            <LookbookFrame
              key={product.id}
              product={product}
              index={i}
              total={total}
              isActive={i === activeIndex}
            />
          ))}
        </div>

        {/* Sticky progress + nav onderaan */}
        <div className="pointer-events-none sticky bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-paper to-paper/0 pt-10 pb-7">
          <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 flex items-center justify-between gap-8">
            <div className="flex-1 max-w-[420px] flex items-center gap-4">
              <span className="eyebrow text-stone tabular-nums">
                {String(activeIndex + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 h-px bg-line relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-[480ms]"
                  style={{
                    width: `${((activeIndex + 1) / total) * 100}%`,
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
              </div>
              <span className="eyebrow text-stone tabular-nums">
                {String(total).padStart(2, "0")}
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={() => scrollToFrame(Math.max(0, activeIndex - 1))}
                disabled={activeIndex === 0}
                aria-label="Vorige frame"
                className="w-11 h-11 flex items-center justify-center border border-ink text-ink hover:bg-ink hover:text-paper transition-colors duration-[280ms] disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ borderRadius: "8px" }}
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => scrollToFrame(Math.min(total - 1, activeIndex + 1))}
                disabled={activeIndex === total - 1}
                aria-label="Volgende frame"
                className="w-11 h-11 flex items-center justify-center border border-ink text-ink hover:bg-ink hover:text-paper transition-colors duration-[280ms] disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ borderRadius: "8px" }}
              >
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LookbookFrame({
  product, index, total, isActive,
}: { product: Product; index: number; total: number; isActive: boolean }) {
  const image = firstImageUrl(product.images);
  const { ref, style } = useReveal<HTMLDivElement>({ delay: 80, distance: 24 });

  return (
    <article className="snap-start flex-shrink-0 w-full lg:w-[90vw] xl:w-[88vw] max-w-[1700px] pl-6 sm:pl-10 lg:pl-14 pr-6 sm:pr-10 lg:pr-14">
      <div
        ref={ref}
        style={{ ...style, transition: `${style.transition}, opacity 720ms cubic-bezier(0.22, 1, 0.36, 1)` }}
        className={`grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-stretch transition-opacity duration-[640ms] ${
          isActive ? "opacity-100" : "opacity-50"
        }`}
      >
        <Link
          href={productUrl(product)}
          className="group block relative aspect-[4/5] lg:aspect-auto lg:min-h-[72vh] overflow-hidden bg-bone rounded-[10px]"
        >
          {image && (
            <Image
              src={cldOptimize(image, { w: 1600 })}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 1024px) 90vw, 60vw"
              priority={index === 0}
            />
          )}
          <div className="absolute top-6 left-6 lg:top-10 lg:left-10 flex items-center gap-2 bg-paper/95 backdrop-blur-sm px-3.5 py-1.5">
            <span className="w-1.5 h-1.5 bg-accent" />
            <span className="eyebrow text-ink tabular-nums">
              Frame {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>
        </Link>

        <div className="flex flex-col justify-between py-2 lg:py-12 pr-2 lg:pr-6">
          <div>
            <p className="eyebrow text-accent mb-6 capitalize">— {product.category}</p>
            <h2
              className="font-serif text-ink leading-[0.98] tracking-[-0.035em] mb-8"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5.5rem)", fontVariationSettings: '"opsz" 144' }}
            >
              {product.name}
            </h2>
            <div className="w-12 h-px bg-accent mb-8" />
            <p className="text-stone text-base lg:text-lg leading-[1.6] max-w-[48ch] mb-10">
              {product.description.length > 280
                ? product.description.slice(0, 280).trim() + "…"
                : product.description}
            </p>
          </div>

          <div className="flex items-end justify-between gap-6 mt-8 pt-8 border-t border-line">
            <div>
              <p className="eyebrow text-stone mb-2">Vanaf</p>
              <p className="font-serif text-3xl text-ink tabular-nums" style={{ fontVariationSettings: '"opsz" 96' }}>
                &euro;{product.price.toFixed(0)},-
              </p>
            </div>
            <Link
              href={productUrl(product)}
              className="group inline-flex items-center gap-3 bg-ink text-paper px-7 py-3.5 rounded-[10px] text-[11px] uppercase tracking-[0.14em] font-medium hover:bg-accent transition-colors duration-[280ms]"
            >
              Bekijk dit stuk
              <ArrowUpRight className="w-4 h-4 group-hover:rotate-12 transition-transform duration-[280ms]" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
