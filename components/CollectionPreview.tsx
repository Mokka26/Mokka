"use client";

import Link from "next/link";
import ProductCard from "./ProductCard";
import { useReveal } from "@/hooks/useReveal";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  images: string;
}

function GridItem({ product, delay }: { product: Product; delay: number }) {
  const { ref, style } = useReveal<HTMLDivElement>({ delay, distance: 30 });
  return (
    <div ref={ref} style={style}>
      <ProductCard product={product} />
    </div>
  );
}

export default function CollectionPreview({ products }: { products: Product[] }) {
  const { ref: headerRef, style: headerStyle } = useReveal<HTMLDivElement>({ distance: 20 });

  return (
    <section className="py-28 lg:py-40 bg-paper">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div
          ref={headerRef}
          style={headerStyle}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end mb-14 lg:mb-20"
        >
          <div className="lg:col-span-8">
            <p className="eyebrow text-accent mb-5">— Nieuwe collectie</p>
            <h2 className="display-md text-ink">
              Voorjaar <span className="italic text-accent" style={{ fontVariationSettings: '"opsz" 144' }}>2026</span>
            </h2>
          </div>
          <div className="lg:col-span-4 flex lg:justify-end">
            <Link href="/products" className="btn-link">
              Bekijk alles
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16">
          {products.slice(0, 8).map((product, i) => (
            <GridItem key={product.id} product={product} delay={i * 60} />
          ))}
        </div>

        <div className="sm:hidden mt-10 text-center">
          <Link href="/products" className="btn-ghost">Bekijk alles</Link>
        </div>
      </div>
    </section>
  );
}
