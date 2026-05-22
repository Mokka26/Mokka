"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
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
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Lock body scroll wanneer mobile sheet open
  useEffect(() => {
    if (!mobileSheetOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSheetOpen]);

  // Group color-broers per colorGroup → ProductCard rendert swatch-row
  const variantsByGroup = useMemo(() => {
    const map = new Map<string, { slug: string; colorName: string | null; colorHex: string | null }[]>();
    for (const p of products) {
      if (!p.colorGroup) continue;
      const arr = map.get(p.colorGroup) ?? [];
      arr.push({ slug: p.slug, colorName: p.colorName, colorHex: p.colorHex });
      map.set(p.colorGroup, arr);
    }
    return map;
  }, [products]);

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

  // Paginatie — initial 24 cards, IntersectionObserver laadt batches van 24 bij
  // bereiken sentinel. Bij filter-wijziging reset naar 24.
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  // Reset paginatie wanneer filter/sort verandert — anders blijft visibleCount
  // hoog terwijl filtered nu kleinere set is.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [maxFilter, inStockOnly, selectedMaterials, sortBy]);

  // IntersectionObserver: sentinel komt in view → laad volgende batch
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= filtered.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, filtered.length]);

  const visible = filtered.slice(0, visibleCount);

  const activeFilterCount =
    (maxFilter < maxPrice ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    selectedMaterials.size;

  const resetFilters = () => {
    setMaxFilter(maxPrice);
    setInStockOnly(false);
    setSelectedMaterials(new Set());
  };

  const filterControls = (
    <FilterControls
      maxPrice={maxPrice}
      maxFilter={maxFilter}
      setMaxFilter={setMaxFilter}
      inStockOnly={inStockOnly}
      setInStockOnly={setInStockOnly}
      availableMaterials={availableMaterials}
      selectedMaterials={selectedMaterials}
      toggleMaterial={toggleMaterial}
      activeFilterCount={activeFilterCount}
      resetFilters={resetFilters}
    />
  );

  return (
    <div className="pt-28 lg:pt-32 pb-20 lg:pb-28">
      {/* Header */}
      <header className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-10 lg:mb-14">
        <p className="eyebrow mb-4">Collectie</p>
        <h1 className="display-lg text-ink mb-6">{category.label}</h1>
        <p className="body-lg text-slate max-w-2xl">{category.intro}</p>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* DESKTOP FILTER-BALK — boven het grid */}
        <div className="hidden lg:block border-y border-line bg-paper/60 backdrop-blur-sm mb-10">
          <div className="px-6 py-5">
            {filterControls}
          </div>
        </div>

        {/* Resultaten + sort (mobile + desktop) */}
        <div className="flex items-center justify-between mb-8 px-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone">
            {filtered.length} van {products.length} producten
          </p>
          <label className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-stone">
            <span className="hidden sm:inline">Sorteer</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-transparent border border-line px-3 py-2 text-ink text-xs focus:outline-none focus:border-accent"
            >
              <option value="newest">Aanbevolen</option>
              <option value="price-asc">Prijs ↑</option>
              <option value="price-desc">Prijs ↓</option>
              <option value="name">Naam A–Z</option>
            </select>
          </label>
        </div>

        {/* Product grid */}
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
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 text-[11px] uppercase tracking-[0.2em] text-accent hover:text-accent-dark"
              >
                Filters wissen
              </button>
            )}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-12 sm:gap-x-4 sm:gap-y-14">
            {visible.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                priority={i < 4}
                variants={p.colorGroup ? variantsByGroup.get(p.colorGroup) : undefined}
              />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div
              ref={sentinelRef}
              aria-hidden
              className="h-12 mt-12 flex items-center justify-center text-[10px] uppercase tracking-[0.2em] text-stone"
            >
              {visible.length} van {filtered.length} geladen…
            </div>
          )}
          </>
        )}
      </div>

      {/* MOBILE FILTER — sticky bottom bar (knop) */}
      <div className="lg:hidden fixed bottom-4 inset-x-4 z-30 flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={() => setMobileSheetOpen(true)}
          className="pointer-events-auto flex items-center gap-2.5 bg-ink text-white px-6 py-3.5 text-[11px] uppercase tracking-[0.25em] shadow-[0_12px_30px_-8px_rgba(20,17,13,0.4)] hover:bg-accent transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters & sortering</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 min-w-5 h-5 inline-flex items-center justify-center rounded-full bg-accent text-[10px] px-1.5">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* MOBILE FILTER — bottom-sheet (modal) */}
      <AnimatePresence>
        {mobileSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
            onClick={() => setMobileSheetOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 bottom-0 bg-paper border-t border-line max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Filters"
            >
              <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between">
                <p className="font-serif text-xl text-ink">Filters</p>
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(false)}
                  aria-label="Sluiten"
                  className="w-9 h-9 inline-flex items-center justify-center text-stone hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-6">
                {filterControls}
              </div>
              <div className="sticky bottom-0 bg-paper border-t border-line px-6 py-4">
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(false)}
                  className="w-full bg-ink text-white px-6 py-3.5 text-[11px] uppercase tracking-[0.25em] hover:bg-accent transition-colors"
                >
                  Toon {filtered.length} resultaten
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Filter-controls component — gedeeld tussen desktop top-bar en mobile sheet
function FilterControls({
  maxPrice,
  maxFilter,
  setMaxFilter,
  inStockOnly,
  setInStockOnly,
  availableMaterials,
  selectedMaterials,
  toggleMaterial,
  activeFilterCount,
  resetFilters,
}: {
  maxPrice: number;
  maxFilter: number;
  setMaxFilter: (n: number) => void;
  inStockOnly: boolean;
  setInStockOnly: (b: boolean) => void;
  availableMaterials: Array<[string, number]>;
  selectedMaterials: Set<string>;
  toggleMaterial: (m: string) => void;
  activeFilterCount: number;
  resetFilters: () => void;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-10">
      {/* Prijs */}
      <div className="lg:min-w-[200px] lg:flex-1 lg:max-w-xs">
        <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-stone mb-2">
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
        <p className="text-xs text-stone mt-1">tot €{maxFilter.toFixed(0)}</p>
      </div>

      {/* Voorraad */}
      <div className="lg:flex-shrink-0">
        <label className="flex items-center gap-2.5 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-ink">Alleen op voorraad</span>
        </label>
      </div>

      {/* Materiaal-chips */}
      {availableMaterials.length > 0 && (
        <div className="lg:flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-stone mb-2 lg:sr-only">
            Materiaal
          </p>
          <div className="flex flex-wrap gap-2">
            {availableMaterials.map(([m, count]) => {
              const active = selectedMaterials.has(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMaterial(m)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-transparent text-ink border-line hover:border-ink"
                  }`}
                >
                  {m} <span className="opacity-60 ml-0.5">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset */}
      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={resetFilters}
          className="lg:flex-shrink-0 text-[11px] uppercase tracking-[0.2em] text-stone hover:text-ink text-left lg:text-right"
        >
          Wissen ({activeFilterCount})
        </button>
      )}
    </div>
  );
}
