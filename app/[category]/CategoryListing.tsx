"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { Drawer } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { FilterChip, PriceFilter, PRICE_MAX, isDefaultPrice, priceInRange, type PriceRange } from "@/components/FilterBar";
import { useFooterInView } from "@/components/product/useFooterInView";
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

const DEFAULT_PRICE: PriceRange = [0, PRICE_MAX];
const FILTER_DRAWER_ID = "category-filters";

function parseMaterials(specs: string | null): string[] {
  if (!specs) return [];
  try {
    const s: unknown = JSON.parse(specs);
    if (typeof s !== "object" || s === null) return [];
    const rec = s as Record<string, unknown>;
    const m = rec.Materiaal ?? rec.materiaal;
    if (typeof m !== "string") return [];
    return m.split(/[,/]\s*/).map((x) => x.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Pagina-URL zoals app/[category]/page.tsx die bouwt: pagina 1 = basis-URL (geen ?page=1). */
function pageHref(slug: string, n: number): string {
  return n <= 1 ? `/${slug}` : `/${slug}?page=${n}`;
}

/**
 * Genummerde paginalijst: 1 … (p-1) p (p+1) … n. `null` = weglatingsteken.
 */
function pageNumbers(page: number, totalPages: number): Array<number | null> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const nums = Array.from(set).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push(null);
    out.push(nums[i]);
  }
  return out;
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
  const [priceRange, setPriceRange] = useState<PriceRange>(DEFAULT_PRICE);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Filterknop verbergen zodra de footer in beeld is (bedekt anders de footerlinks).
  const footerInView = useFooterInView();

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

  const inStockCount = useMemo(() => products.filter((p) => (p.stock ?? 0) > 0).length, [products]);

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
    let arr = products.filter((p) => priceInRange(p.price, priceRange));
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
  }, [products, priceRange, inStockOnly, selectedTypes, selectedMaterials, sortBy]);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  const activeFilterCount =
    (isDefaultPrice(priceRange) ? 0 : 1) +
    (inStockOnly ? 1 : 0) +
    selectedTypes.size +
    selectedMaterials.size;

  const resetFilters = () => {
    setPriceRange(DEFAULT_PRICE);
    setInStockOnly(false);
    setSelectedTypes(new Set());
    setSelectedMaterials(new Set());
  };

  const resultLabel = `${filtered.length} ${filtered.length === 1 ? "product" : "producten"}`;

  const filterControls = (idPrefix: string) => (
    <FilterControls
      idPrefix={idPrefix}
      priceRange={priceRange}
      setPriceRange={setPriceRange}
      inStockOnly={inStockOnly}
      inStockCount={inStockCount}
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
          <div className="px-6 py-5">{filterControls("desktop")}</div>
        </div>

        {/* Resultaten + sort (mobile + desktop) */}
        <div className="flex items-center justify-between gap-4 mb-8 px-2">
          <p className="eyebrow-lg" aria-live="polite" aria-atomic="true">
            {activeFilterCount > 0
              ? `${filtered.length} van ${products.length} op deze pagina`
              : `${rangeStart}–${rangeEnd} van ${totalCount} producten`}
          </p>
          <label className="flex items-center gap-3 eyebrow-lg">
            <span className="hidden sm:inline">Sorteer</span>
            <span className="sr-only sm:hidden">Sorteer</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="min-h-11 bg-transparent border border-line-strong rounded-[8px] px-3 py-2 text-ink text-base normal-case tracking-normal focus:border-ink"
            >
              <option value="newest">Aanbevolen</option>
              <option value="price-asc">Prijs oplopend</option>
              <option value="price-desc">Prijs aflopend</option>
              <option value="name">Naam A–Z</option>
            </select>
          </label>
        </div>

        {/* Kop voor het grid (H1 → H2 → H3 kaartnamen), alleen voor screenreaders. */}
        <h2 className="sr-only">Producten</h2>

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
              <button type="button" onClick={resetFilters} className="btn-link mt-6">
                Filters wissen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12">
            {filtered.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                priority={i < 2}
                variants={p.colorGroup ? variants[p.colorGroup] : undefined}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav aria-label="Paginering" className="mt-16 border-t border-line pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {prevHref ? (
                <Link href={prevHref} rel="prev" className="btn-ghost text-center">
                  Vorige
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}

              <ol className="flex items-center gap-1 list-none m-0 p-0 order-last w-full justify-center sm:order-none sm:w-auto">
                {pageNumbers(page, totalPages).map((n, i) =>
                  n === null ? (
                    <li key={`gap-${i}`} aria-hidden="true" className="inline-flex items-center justify-center min-w-8 min-h-11 text-stone">
                      …
                    </li>
                  ) : (
                    <li key={n}>
                      {n === page ? (
                        <span
                          aria-current="page"
                          className="inline-flex items-center justify-center min-w-11 min-h-11 px-2 rounded-[8px] bg-ink text-paper text-base tabular-nums"
                        >
                          <span className="sr-only">Pagina </span>
                          {n}
                        </span>
                      ) : (
                        <Link
                          href={pageHref(category.slug, n)}
                          className="inline-flex items-center justify-center min-w-11 min-h-11 px-2 rounded-[8px] text-ink text-base tabular-nums hover:bg-bone transition-colors"
                        >
                          <span className="sr-only">Pagina </span>
                          {n}
                        </Link>
                      )}
                    </li>
                  ),
                )}
              </ol>

              {nextHref ? (
                <Link href={nextHref} rel="next" className="btn-primary text-center">
                  Volgende
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          </nav>
        )}
      </div>

      {/* Ruimte voor de zwevende filterknop (mobiel), incl. safe-area. */}
      <div className="lg:hidden h-[calc(5rem+env(safe-area-inset-bottom))]" aria-hidden="true" />

      {/* MOBILE FILTER — zwevende knop; schuift boven de cookiebanner uit
          (--cookie-banner-h) en verdwijnt zodra de footer in beeld is. */}
      <div
        aria-hidden={footerInView || undefined}
        inert={footerInView || undefined}
        className={`lg:hidden fixed inset-x-4 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+var(--cookie-banner-h,0px))] z-30 flex justify-center pointer-events-none transition-[transform,opacity,bottom] duration-[280ms] ${
          footerInView ? "translate-y-[150%] opacity-0" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls={FILTER_DRAWER_ID}
          className="pointer-events-auto flex items-center gap-2.5 min-h-12 bg-ink text-paper px-6 py-3 rounded-full text-[15px] font-medium shadow-[0_12px_30px_-8px_rgba(20,17,13,0.4)] hover:bg-accent-dark transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="min-w-6 h-6 inline-flex items-center justify-center rounded-full bg-paper text-ink text-[13px] font-medium tabular-nums px-1.5">
              {activeFilterCount}
              <span className="sr-only"> actieve filters</span>
            </span>
          )}
        </button>
      </div>

      {/* MOBILE FILTER — bottom-sheet op het native <dialog>-element */}
      <Drawer
        id={FILTER_DRAWER_ID}
        side="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
        className="rounded-t-2xl"
        footer={
          <div className="px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-3">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="underline underline-offset-4">
                Wissen
              </Button>
            )}
            <Button onClick={() => setDrawerOpen(false)} className="flex-1">
              Toon {resultLabel}
            </Button>
          </div>
        }
      >
        <div className="px-6 py-6">{filterControls("sheet")}</div>
      </Drawer>
    </div>
  );
}

// Filter-controls — gedeeld tussen desktop top-bar en mobiele sheet. Bouwstenen
// (PriceFilter, FilterChip) komen uit components/FilterBar.tsx zodat /products
// en de categoriepagina's identiek werken.
function FilterControls({
  idPrefix,
  priceRange,
  setPriceRange,
  inStockOnly,
  inStockCount,
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
  idPrefix: string;
  priceRange: PriceRange;
  setPriceRange: (r: PriceRange) => void;
  inStockOnly: boolean;
  inStockCount: number;
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
    <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10">
      {/* Type (alleen umbrella, bv. Tafels) */}
      {availableTypes.length > 1 && (
        <div className="lg:flex-shrink-0">
          <p className="eyebrow-lg mb-2" id={`${idPrefix}-type-label`}>Type</p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${idPrefix}-type-label`}>
            {availableTypes.map(({ cat, label, count }) => (
              <FilterChip key={cat} label={label} count={count} active={selectedTypes.has(cat)} onClick={() => toggleType(cat)} />
            ))}
          </div>
        </div>
      )}

      {/* Prijs — zelfde klassen en velden als /products */}
      <div className="lg:flex-1 lg:max-w-xl">
        <p className="eyebrow-lg mb-2">Prijs</p>
        <PriceFilter priceRange={priceRange} onPriceRangeChange={setPriceRange} idPrefix={`${idPrefix}-price`} />
      </div>

      {/* Voorraad */}
      <div className="lg:flex-shrink-0">
        <p className="eyebrow-lg mb-2">Voorraad</p>
        <FilterChip label="Op voorraad" count={inStockCount} dot active={inStockOnly} onClick={() => setInStockOnly(!inStockOnly)} />
      </div>

      {/* Materiaal-chips */}
      {availableMaterials.length > 0 && (
        <div className="lg:flex-1">
          <p className="eyebrow-lg mb-2" id={`${idPrefix}-material-label`}>Materiaal</p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${idPrefix}-material-label`}>
            {availableMaterials.map(([m, count]) => (
              <FilterChip key={m} label={m} count={count} active={selectedMaterials.has(m)} onClick={() => toggleMaterial(m)} />
            ))}
          </div>
        </div>
      )}

      {/* Reset — desktop (de sheet heeft 'm in de voet) */}
      {activeFilterCount > 0 && (
        <button type="button" onClick={resetFilters} className="btn-link hidden lg:inline-flex lg:flex-shrink-0 self-start">
          Wissen ({activeFilterCount})
        </button>
      )}
    </div>
  );
}
