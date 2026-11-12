"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import ProductCard, { type ProductCardVariant } from "@/components/ProductCard";
import { ProductGrid } from "@/components/ProductGrid";
import { useFooterInView } from "@/components/product/useFooterInView";
import { productUrl } from "@/lib/categories";
import { trackSelectItem, trackViewItemList } from "@/lib/analytics";
import {
  activeFilterCount,
  emptyFilters,
  filtersToQuery,
  type ActiveFilters,
  type Facet,
  type FacetOption,
} from "@/lib/filters";
import { ActiveFilterChips, FilterDrawer, FilterToolbar, RESULTS_ID, SortSelect } from "./CategoryFilters";

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
  sizeName: string | null;
  specs: string | null;
};

/** Variant van een model op de kaart (kleur, maat, prijs, voorraad). */
export type ListingVariant = ProductCardVariant;

interface Props {
  /** Alleen slug (URL + GA4-lijst) en label worden gebruikt; /products geeft een eigen waarde mee. */
  category: { slug: string; label: string };
  /** De kaarten van déze pagina (max. 24), al gefilterd en gesorteerd op de server. */
  products: ListingProduct[];
  /** Swatch-rij per colorGroup voor de kaarten op deze pagina. */
  variants: Record<string, ListingVariant[]>;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Aantal modellen ná filteren. */
  totalCount: number;
  /** Aantal modellen in de hele categorie (zonder filters). */
  categoryCount: number;
  prevHref: string | null;
  nextHref: string | null;
  /** Actieve filters/sortering als querystring (zonder pagina). */
  query: string;
  filters: ActiveFilters;
  facets: Facet[];
  priceOptions: FacetOption[];
  inStockCount: number;
  /** Vaste querydeel dat bij elke filterwijziging blijft staan (bv. `q=bank` op /products). */
  baseQuery?: string;
  /** Eigen tekst als er niets gevonden is (bv. zoekresultaten). */
  empty?: { title: string; text: string };
}

const FILTER_DRAWER_ID = "category-filters";

/** Pagina-URL met de actieve filters; pagina 1 = zonder ?page. */
function pageHref(slug: string, n: number, query: string): string {
  const q = new URLSearchParams(query);
  if (n > 1) q.set("page", String(n));
  const s = q.toString().replace(/%2C/gi, ",");
  return s ? `/${slug}?${s}` : `/${slug}`;
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

const productsLabel = (n: number) => `${n} ${n === 1 ? "product" : "producten"}`;

export default function CategoryListing({
  category,
  products,
  variants,
  page,
  pageSize,
  totalPages,
  totalCount,
  categoryCount,
  prevHref,
  nextHref,
  query,
  filters,
  facets,
  priceOptions,
  inStockCount,
  baseQuery = "",
  empty,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Filterknop verbergen zodra de footer in beeld is (bedekt anders de footerlinks).
  const footerInView = useFooterInView();

  /** Nieuwe filterstaat → URL (pagina terug naar 1); de server rendert het resultaat. */
  const applyFilters = (next: ActiveFilters) => {
    const q = [baseQuery, filtersToQuery(next)].filter(Boolean).join("&");
    startTransition(() => {
      router.push(q ? `/${category.slug}?${q}` : `/${category.slug}`, { scroll: false });
    });
  };
  const clearFilters = () => applyFilters(emptyFilters(filters.sort));

  // GA4: zichtbare lijst (per pagina/filtercombinatie) en klik op een kaart.
  const listOffset = (page - 1) * pageSize;
  const listKey = products.map((p) => p.id).join(",");
  useEffect(() => {
    trackViewItemList(category.slug, category.label, products, listOffset);
    // listKey vat de producten samen; products zelf is per render een nieuwe array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.slug, category.label, listKey, listOffset]);
  const onGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
    const href = link?.getAttribute("href");
    if (!href) return;
    const index = products.findIndex((p) => href.startsWith(productUrl(p)));
    if (index >= 0) trackSelectItem(category.slug, category.label, products[index], listOffset + index);
  };

  const activeCount = activeFilterCount(filters);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const filterProps = { filters, facets, priceOptions, inStockCount, onChange: applyFilters };

  return (
    <div>
      <div className="max-w-page mx-auto px-6 sm:px-10 lg:px-14">
        {/* Filterrij (desktop) + sorteren */}
        <div className="border-y border-line py-4 mb-6 px-2">
          <div className="flex items-center justify-between gap-4">
            <div className="hidden lg:block min-w-0 flex-1">
              <FilterToolbar {...filterProps} />
            </div>
            <p className="lg:hidden text-base text-graphite tabular-nums" aria-hidden="true">
              {productsLabel(totalCount)}
            </p>
            <SortSelect value={filters.sort} onChange={(sort) => applyFilters({ ...filters, sort })} />
          </div>
        </div>

        {/* Resultaat + actieve filters */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-8 px-2 min-h-11">
          <p id={RESULTS_ID} tabIndex={-1} className="text-base text-graphite tabular-nums" aria-live="polite" aria-atomic="true">
            {isPending ? (
              "Producten laden…"
            ) : activeCount > 0 ? (
              <>
                <span className="text-ink font-medium">{productsLabel(totalCount)}</span>
                <span> van {categoryCount}</span>
              </>
            ) : totalPages > 1 ? (
              `${rangeStart}–${rangeEnd} van ${productsLabel(totalCount)}`
            ) : (
              productsLabel(totalCount)
            )}
          </p>
          {activeCount > 0 && (
            <ActiveFilterChips filters={filters} facets={facets} onChange={applyFilters} onClear={clearFilters} />
          )}
        </div>

        {/* Kop voor het grid (H1 → H2 → H3 kaartnamen), alleen voor screenreaders. */}
        <h2 className="sr-only">Producten</h2>

        <div aria-busy={isPending} className={`transition-opacity duration-200 ${isPending ? "opacity-50" : ""}`}>
          {products.length === 0 ? (
            <div className="text-center py-24">
              <p className="font-serif text-2xl text-ink mb-4">
                {empty?.title ?? (categoryCount === 0 ? "Nog geen producten" : "Geen producten met deze filters")}
              </p>
              <p className="text-base text-graphite">
                {empty?.text ??
                  (categoryCount === 0
                    ? "Deze collectie wordt binnenkort gevuld."
                    : "Haal een filter weg of kies een andere combinatie.")}
              </p>
              {activeCount > 0 && (
                <button type="button" onClick={clearFilters} className="btn-ghost mt-8">
                  Alle filters wissen
                </button>
              )}
            </div>
          ) : (
            <ProductGrid onClick={onGridClick}>
              {products.map((p, i) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  priority={i < 2}
                  variants={p.colorGroup ? variants[p.colorGroup] : undefined}
                />
              ))}
            </ProductGrid>
          )}
        </div>

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
                          href={pageHref(category.slug, n, query)}
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
          className="pointer-events-auto flex items-center gap-2.5 min-h-12 bg-ink text-paper px-6 py-3 rounded-full text-base font-medium shadow-[0_12px_30px_-8px_rgba(20,17,13,0.4)] hover:bg-accent-dark transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          <span>Filteren</span>
          {activeCount > 0 && (
            <span className="min-w-6 h-6 inline-flex items-center justify-center rounded-full bg-paper text-ink text-sm font-medium tabular-nums px-1.5">
              {activeCount}
              <span className="sr-only"> actieve filters</span>
            </span>
          )}
        </button>
      </div>

      <FilterDrawer
        id={FILTER_DRAWER_ID}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        resultLabel={productsLabel(totalCount)}
        isPending={isPending}
        onClear={clearFilters}
        {...filterProps}
      />
    </div>
  );
}
