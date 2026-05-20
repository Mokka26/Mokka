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

function getMaxPrice(products: Product[]): number {
  return Math.max(100, ...products.map((p) => p.price));
}

function parseMaterials(specs: string | null): string[] {
  if (!specs) return [];
  try {
    const s = JSON.parse(specs);
    const m = s.Materiaal ?? s.materiaal;
    if (!m || typeof m !== "string") return [];
    return m.split(/[,/]\s*/).map((x: string) => x.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export default function CategoryListing({ category, products }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const maxPrice = useMemo(() => getMaxPrice(products), [products]);
  const [maxFilter, setMaxFilter] = useState(maxPrice);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());

  // Verzamel beschikbare materialen uit huidige producten
  const availableMaterials = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      for (const m of parseMaterials(p.specs)) {
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [products]);

  const toggleMaterial = (m: string) =>
    setSelectedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  // Apply filters + sort
  const filtered = useMemo(() => {
    let arr = products.filter((p) => p.price <= maxFilter);
    if (inStockOnly) arr = arr.filter((p) => (p.stock ?? 0) > 0);
    if (selectedMaterials.size > 0) {
      arr = arr.filter((p) => {
        const mats = parseMaterials(p.specs);
        return mats.some((m) => selectedMaterials.has(m));
      });
    }
    switch (sortBy) {
      case "price-asc":
        return arr.sort((a, b) => a.price - b.price);
      case "price-desc":
        return arr.sort((a, b) => b.price - a.price);
      case "name":
        return arr.sort((a, b) => a.name.localeCompare(b.name, "nl"));
      default:
        return arr;
    }
  }, [products, maxFilter, inStockOnly, selectedMaterials, sortBy]);

  const hasActiveFilter =
    maxFilter < maxPrice || inStockOnly || selectedMaterials.size > 0;

  return (
    <div className="pt-28 lg:pt-32 pb-20">
      <header className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-14 lg:mb-20">
        <p className="eyebrow mb-4">Collectie</p>
        <h1 className="display-lg text-ink mb-6">{category.label}</h1>
        <p className="body-lg text-slate max-w-2xl">{category.intro}</p>
        <p className="text-sm text-stone mt-6">
          {filtered.length} van {products.length} product{products.length === 1 ? "" : "en"}
        </p>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10 lg:gap-12">
        {/* Filter-sidebar */}
        <aside className="lg:sticky lg:top-32 lg:self-start space-y-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-ink mb-4">
              Prijs (max)
            </p>
            <input
              type="range"
              min={100}
              max={maxPrice}
              step={50}
              value={maxFilter}
              onChange={(e) => setMaxFilter(Number(e.target.value))}
              className="w-full accent-accent"
              aria-label="Maximum prijs"
            />
            <p className="text-xs text-stone mt-2">tot €{maxFilter.toFixed(0)}</p>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <span className="text-sm text-ink">Alleen op voorraad</span>
            </label>
          </div>

          {availableMaterials.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-ink mb-4">
                Materiaal
              </p>
              <ul className="space-y-2">
                {availableMaterials.map(([m, count]) => (
                  <li key={m}>
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.has(m)}
                        onChange={() => toggleMaterial(m)}
                        className="w-4 h-4 accent-accent"
                      />
                      <span className="text-ink">{m}</span>
                      <span className="text-stone/60 text-xs tabular-nums">({count})</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setMaxFilter(maxPrice);
                setInStockOnly(false);
                setSelectedMaterials(new Set());
              }}
              className="text-[11px] uppercase tracking-[0.2em] text-stone hover:text-ink"
            >
              Filters wissen
            </button>
          )}
        </aside>

        <div>
          {/* Sort-balk */}
          <div className="flex items-center justify-between mb-10 lg:mb-14 px-2">
            <div className="text-xs uppercase tracking-[0.2em] text-stone">
              {filtered.length} resultaten
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

          {filtered.length === 0 ? (
            <div className="text-center py-32">
              <p className="font-serif text-2xl text-ink mb-4">
                {products.length === 0 ? "Nog geen producten" : "Geen resultaten"}
              </p>
              <p className="text-sm text-stone">
                {products.length === 0
                  ? "Deze collectie wordt binnenkort gevuld."
                  : "Pas je filters aan om meer producten te zien."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-12 sm:gap-x-4 sm:gap-y-14">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
