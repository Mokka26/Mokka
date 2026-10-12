"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { getCategory, type Category } from "@/lib/categories";

export type ListingProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  listPrice: number | null;
  category: string;
  images: string;
  featured: boolean;
  stock: number;
  createdAt: Date | string;
  deliveryTime: string | null;
  sizeVariants: string | null;
  colorGroup: string | null;
  colorName: string | null;
  colorHex: string | null;
  specs: string | null;
};

export type ListingVariant = { slug: string; colorName: string | null; colorHex: string | null };

type Product = ListingProduct;

interface Props {
  category: Category;
  /** De producten van déze pagina (max. 24), al ontdubbeld per kleurgroep. */
  products: Product[];
  /** Swatch-rij per colorGroup voor de kaarten op deze pagina. */
  variants: Record<string, ListingVariant[]>;
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  prevHref: string | null;
  nextHref: string | null;
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

export default function CategoryListing({
  category,
  products,
  variants,
  page,
  pageSize,
  totalPages,
  totalCount,
  prevHref,
  nextHref,
}: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const maxPrice = useMemo(() => getMaxPrice(products), [products]);
  const [maxFilter, setMaxFilter] = useState(maxPrice);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Lock body scroll wanneer mobile sheet open
  useEffect(() => {
    if (!mobileSheetOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSheetOpen]);

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

  // Type-filter — alleen op umbrella-categorie (bv. Tafels): toon de onderliggende
  // typen (Eettafels, Salontafels …) als filterbare chips.
  const availableTypes = useMemo(() => {
    if (!category.isUmbrella) return [] as Array<{ cat: string; label: string; count: number }>;
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([cat, count]) => ({ cat, label: getCategory(cat)?.label ?? cat, count }))
      .sort((a, b) => b.count - a.count);
  }, [products, category.isUmbrella]);

  const toggleType = (c: string) =>
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  // Filters en sortering werken binnen de geladen pagina (24 producten); de
  // paginering zelf is server-side (?page=N) zodat elke pagina echt in de
  // HTML staat.
  const filtered = useMemo(() => {
    let arr = products.filter((p) => p.price <= maxFilter);
    if (inStockOnly) arr = arr.filter((p) => (p.stock ?? 0) > 0);
    if (selectedTypes.size > 0) arr = arr.filter((p) => selectedTypes.has(p.category));
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
  }, [products, maxFilter, inStockOnly, selectedTypes, selectedMaterials, sortBy]);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  const activeFilterCount =
    (maxFilter < maxPrice ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    selectedTypes.size +
    selectedMaterials.size;

  const resetFilters = () => {
    setMaxFilter(maxPrice);
    setInStockOnly(false);
    setSelectedTypes(new Set());
    setSelectedMaterials(new Set());
  };

  const filterControls = (
    <FilterControls
      maxPrice={maxPrice}
      maxFilter={maxFilter}
      setMaxFilter={setMaxFilter}
      inStockOnly={inStockOnly}
      setInStockOnly={setInStockOnly}
      availableTypes={availableTypes}
      selectedTypes={selectedTypes}
      toggleType={toggleType}
      availableMaterials={availableMaterials}
      selectedMaterials={selectedMaterials}
      toggleMaterial={toggleMaterial}
      activeFilterCount={activeFilterCount}
      resetFilters={resetFilters}
    />
  );

  return (
    <div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* DESKTOP FILTER-BALK — boven het grid */}
        <div className="hidden lg:block border-y border-line bg-paper/60 backdrop-blur-sm mb-10">
          <div className="px-6 py-5">
            {filterControls}
          </div>
        </div>

        {/* Resultaten + sort (mobile + desktop) */}
        <div className="flex items-center justify-between mb-8 px-2">
          <p className="eyebrow-lg">
            {activeFilterCount > 0
              ? `${filtered.length} van ${products.length} op deze pagina`
              : `${rangeStart}–${rangeEnd} van ${totalCount} producten`}
          </p>
          <label className="flex items-center gap-3 eyebrow-lg">
            <span className="hidden sm:inline">Sorteer</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="min-h-11 bg-transparent border border-line-strong rounded-[8px] px-3 py-2 text-ink text-sm normal-case tracking-normal focus:border-ink"
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
            <p className="text-base text-stone">
              {products.length === 0
                ? "Deze collectie wordt binnenkort gevuld."
                : "Pas je filters aan om meer producten te zien."}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="btn-link mt-6"
              >
                Filters wissen
              </button>
            )}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12">
            {filtered.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                priority={i < 2}
                wide={p.category === "hoekbanken" || p.category === "bankstellen" || p.category === "slaapkamers" || p.category === "jeugdkamers"}
                variants={p.colorGroup ? variants[p.colorGroup] : undefined}
              />
            ))}
          </div>
          </>
        )}

        {totalPages > 1 && (
          <nav aria-label="Paginering" className="mt-16 flex items-center justify-between gap-6 border-t border-line pt-8">
            {prevHref ? (
              <Link href={prevHref} rel="prev" className="btn-ghost text-center">
                Vorige
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            <p className="eyebrow-lg">
              Pagina {page} van {totalPages}
            </p>
            {nextHref ? (
              <Link href={nextHref} rel="next" className="btn-primary text-center">
                Volgende
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        )}
      </div>

      {/* MOBILE FILTER — sticky bottom bar (knop) */}
      <div className="lg:hidden fixed bottom-4 inset-x-4 z-30 flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={() => setMobileSheetOpen(true)}
          className="pointer-events-auto flex items-center gap-2.5 min-h-11 bg-ink text-white px-6 py-3 rounded-[10px] text-sm font-medium uppercase tracking-[0.1em] shadow-[0_12px_30px_-8px_rgba(20,17,13,0.4)] hover:bg-accent transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          <span>Filters & sortering</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 min-w-6 h-6 inline-flex items-center justify-center rounded-full bg-accent text-sm tabular-nums px-1.5">
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
                  className="w-11 h-11 inline-flex items-center justify-center rounded-full text-stone hover:text-ink hover:bg-bone"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              <div className="px-6 py-6">
                {filterControls}
              </div>
              <div className="sticky bottom-0 bg-paper border-t border-line px-6 py-4">
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(false)}
                  className="btn-primary w-full"
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
  availableTypes,
  selectedTypes,
  toggleType,
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
  availableTypes: Array<{ cat: string; label: string; count: number }>;
  selectedTypes: Set<string>;
  toggleType: (c: string) => void;
  availableMaterials: Array<[string, number]>;
  selectedMaterials: Set<string>;
  toggleMaterial: (m: string) => void;
  activeFilterCount: number;
  resetFilters: () => void;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-10">
      {/* Type (alleen umbrella, bv. Tafels) */}
      {availableTypes.length > 1 && (
        <div className="lg:flex-shrink-0">
          <p className="eyebrow-lg mb-2">Type</p>
          <div className="flex flex-wrap gap-2">
            {availableTypes.map(({ cat, label, count }) => {
              const active = selectedTypes.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleType(cat)}
                  className={`inline-flex items-center min-h-11 px-4 py-2 text-sm border rounded-full transition-colors ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-transparent text-ink border-line hover:border-ink"
                  }`}
                >
                  {label} <span className="ml-1 tabular-nums">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Prijs */}
      <div className="lg:min-w-[200px] lg:flex-1 lg:max-w-xs">
        <p className="eyebrow-lg mb-2">
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
        <p className="text-sm text-stone mt-1 tabular-nums">tot €{maxFilter.toFixed(0)}</p>
      </div>

      {/* Voorraad */}
      <div className="lg:flex-shrink-0">
        <label className="flex items-center gap-2.5 min-h-11 cursor-pointer text-base">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="w-5 h-5 accent-accent"
          />
          <span className="text-ink">Alleen op voorraad</span>
        </label>
      </div>

      {/* Materiaal-chips */}
      {availableMaterials.length > 0 && (
        <div className="lg:flex-1">
          <p className="eyebrow-lg mb-2 lg:sr-only">
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
                  className={`inline-flex items-center min-h-11 px-4 py-2 text-sm border rounded-full transition-colors ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-transparent text-ink border-line hover:border-ink"
                  }`}
                >
                  {m} <span className="ml-1 tabular-nums">({count})</span>
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
          className="btn-link lg:flex-shrink-0 self-start lg:self-end"
        >
          Wissen ({activeFilterCount})
        </button>
      )}
    </div>
  );
}
