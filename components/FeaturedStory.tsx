"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { firstImageUrl } from "@/lib/imageHelpers";
import { useReveal } from "@/hooks/useReveal";
import { useClipReveal } from "@/hooks/useClipReveal";
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

export default function FeaturedStory({ product }: { product: Product | null }) {
  const textReveal = useReveal<HTMLDivElement>({ distance: 30 });
  const imageReveal = useClipReveal<HTMLDivElement>({ from: "bottom", duration: 1100, delay: 120 });

  if (!product) return null;

  const mainImage = firstImageUrl(product.images);
  if (!mainImage) return null;

  return (
    <section className="py-28 lg:py-44 bg-ink text-white overflow-hidden">
      {/* Edge-bleed grid — image flush naar right viewport edge op desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,1100px)] lg:gap-20 items-center max-w-[100vw]">
        {/* LINKS — Tekst/verhaal, contained binnen 1600px max */}
        <div className="px-6 sm:px-10 lg:pl-[max(56px,calc((100vw-1600px)/2+56px))] lg:pr-0 order-2 lg:order-1">
          <div
            ref={textReveal.ref}
            style={textReveal.style}
            className="max-w-[560px]"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] font-medium text-accent-light mb-6">
              — In de spotlight
            </p>

            <p className="text-white/50 text-[10px] uppercase tracking-[0.14em] font-medium mb-4 capitalize">
              {product.category}
            </p>
            <h2
              className="font-serif text-white text-[clamp(2.5rem,5.5vw,5rem)] leading-[0.98] tracking-[-0.035em] mb-8"
              style={{ fontVariationSettings: '"opsz" 144' }}
            >
              {product.name}
            </h2>

            <div className="w-12 h-[1px] bg-accent mb-8" />

            <p className="text-white/70 text-base lg:text-lg leading-[1.6] mb-10 max-w-[55ch]">
              {product.description}
            </p>

            {/* Meta + CTA */}
            <div className="flex items-center gap-8 mb-12">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] mb-1.5">Vanaf</p>
                <p className="font-serif text-3xl text-white tabular-nums">
                  &euro;{product.price.toFixed(0)},-
                </p>
              </div>
              <div className="w-[1px] h-12 bg-white/15" />
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] mb-1.5">Levertijd</p>
                <p className="font-serif text-lg text-white">2–4 weken</p>
              </div>
            </div>

            <Link
              href={productUrl(product)}
              className="group inline-flex items-center gap-3 bg-white text-ink px-8 py-4 rounded-[10px] text-[11px] uppercase tracking-[0.25em] font-medium hover:bg-accent hover:text-white transition-all duration-400"
            >
              Bekijk dit stuk
              <ArrowUpRight className="w-4 h-4 group-hover:rotate-12 transition-transform" strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        {/* RECHTS — Groot beeld bleed naar right viewport edge, clip-reveal van onder */}
        <div
          ref={imageReveal.ref}
          style={imageReveal.style}
          className="order-1 lg:order-2 px-6 sm:px-10 lg:px-0"
        >
          <Link href={productUrl(product)} className="group block relative">
            <div className="relative aspect-[4/5] lg:aspect-[5/6] overflow-hidden bg-bone rounded-[10px] transition-all duration-500 group-hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
              <Image
                src={mainImage}
                alt={product.name}
                fill
                className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.04]"
                sizes="(max-width: 1024px) 100vw, 65vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent opacity-60" />
            </div>

            {/* Floating label — square, niet rounded */}
            <div className="absolute top-6 right-6 lg:right-[max(56px,calc((100vw-1600px)/2+56px))] flex items-center gap-2 bg-paper/95 backdrop-blur-sm px-3.5 py-1.5">
              <span className="w-1.5 h-1.5 bg-accent" />
              <span className="eyebrow text-ink">Editie 01</span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
