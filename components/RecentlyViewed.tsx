"use client";

import { useEffect, useState } from "react";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import ProductCard from "@/components/ProductCard";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  images: string;
  stock?: number;
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  specs?: string | null;
}

interface Props {
  currentSlug?: string;
  max?: number;
}

export default function RecentlyViewed({ currentSlug, max = 4 }: Props) {
  const slugs = useRecentlyViewed(currentSlug);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (slugs.length === 0) {
      setProducts([]);
      return;
    }
    const ctrl = new AbortController();
    fetch("/api/products/by-slugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: slugs.slice(0, max) }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => setProducts(d.products ?? []))
      .catch(() => null);
    return () => ctrl.abort();
  }, [slugs, max]);

  if (products.length === 0) return null;

  return (
    <section className="bg-paper py-16 lg:py-24 border-t border-line">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone mb-3">Voor jou</p>
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-ink">
            Recent bekeken
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      </div>
    </section>
  );
}
