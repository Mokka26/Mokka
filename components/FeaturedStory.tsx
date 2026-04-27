"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

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
  if (!product) return null;

  const images: string[] = JSON.parse(product.images);
  const mainImage = images[0];

  return (
    <section className="py-24 lg:py-40 bg-ink text-white overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* LINKS — Tekst/verhaal */}
          <motion.div
            className="lg:col-span-5 order-2 lg:order-1"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center gap-4 mb-8">
              <span className="font-serif italic text-bronze text-sm">— In de spotlight</span>
            </div>

            <p className="text-white/50 text-[11px] uppercase tracking-[0.3em] mb-4">
              {product.category}
            </p>
            <h2 className="font-serif text-white text-[clamp(2.25rem,5vw,4.5rem)] leading-[1] mb-8">
              {product.name}
            </h2>

            <div className="w-16 h-[1px] bg-white/30 mb-8" />

            <p className="text-white/70 text-base lg:text-lg leading-[1.8] mb-10 max-w-md">
              {product.description}
            </p>

            {/* Meta + CTA */}
            <div className="flex items-center gap-8 mb-10">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] mb-1">Vanaf</p>
                <p className="font-serif text-3xl text-white">
                  &euro;{product.price.toFixed(0)}
                </p>
              </div>
              <div className="w-[1px] h-12 bg-white/20" />
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] mb-1">Levertijd</p>
                <p className="font-serif text-lg text-white">2–4 weken</p>
              </div>
            </div>

            <Link
              href={`/products/${product.slug}`}
              className="inline-flex items-center gap-3 bg-white text-ink px-8 py-4 text-[11px] uppercase tracking-[0.25em] font-medium hover:bg-bronze hover:text-white transition-colors duration-400"
            >
              Bekijk dit stuk
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
          </motion.div>

          {/* RECHTS — Groot beeld */}
          <motion.div
            className="lg:col-span-7 order-1 lg:order-2"
            initial={{ opacity: 0, scale: 1.02 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <Link href={`/products/${product.slug}`} className="group block relative">
              <div className="relative aspect-[4/5] lg:aspect-[5/6] overflow-hidden bg-dark">
                <Image
                  src={mainImage}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.03]"
                  sizes="(max-width: 1024px) 100vw, 58vw"
                />
                {/* Subtiele vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent opacity-50" />
              </div>

              {/* Floating label */}
              <div className="absolute top-6 right-6 flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-bronze" />
                <span className="text-ink text-[10px] uppercase tracking-[0.3em]">Editie 01</span>
              </div>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
