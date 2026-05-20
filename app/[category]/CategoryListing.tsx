"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import type { Category } from "@/lib/categories";

type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  images: string;
  featured: boolean;
  stock: number;
  createdAt: Date | string;
  colorGroup: string | null;
  colorName: string | null;
  colorHex: string | null;
  specs: string | null;
};

interface Props {
  category: Category;
  products: Product[];
}

type SortKey = "newest" | "price-asc" | "price-desc" | "name";

export default function CategoryListing({ category, products }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const sorted = useMemo(() => {
    const arr = [...products];
    switch (sortBy) {
      case "price-asc":
        return arr.sort((a, b) => a.price - b.price);
      case "price-desc":
        return arr.sort((a, b) => b.price - a.price);
      case "name":
        return arr.sort((a, b) => a.name.localeCompare(b.name, "nl"));
      default:
        return arr; // server-volgorde (featured + createdAt desc)
    }
  }, [products, sortBy]);

  return (
    <div className="pt-28 lg:pt-32 pb-20">
      <header className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-14 lg:mb-20">
        <p className="eyebrow mb-4">Collectie</p>
        <h1 className="display-lg text-ink mb-6">{category.label}</h1>
        <p className="body-lg text-slate max-w-2xl">{category.intro}</p>
        <p className="text-sm text-stone mt-6">
          {products.length} product{products.length === 1 ? "" : "en"}
        </p>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Sort-balk */}
        <div className="flex items-center justify-between mb-10 lg:mb-14 px-2">
          <div className="text-xs uppercase tracking-[0.2em] text-stone">
            {sorted.length} resultaten
          </div>
          <label className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-stone">
            <span>Sorteer</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-transparent border border-line px-3 py-2 text-ink focus:outline-none focus:border-accent"
            >
              <option value="newest">Aanbevolen</option>
              <option value="price-asc">Prijs ↑</option>
              <option value="price-desc">Prijs ↓</option>
              <option value="name">Naam A–Z</option>
            </select>
          </label>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-32">
            <p className="font-serif text-2xl text-ink mb-4">Nog geen producten</p>
            <p className="text-sm text-stone">Deze collectie wordt binnenkort gevuld.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-12 sm:gap-x-4 sm:gap-y-14">
            {sorted.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
