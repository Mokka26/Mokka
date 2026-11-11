import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { CATEGORIES, getCategory, isCategorySlug } from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";
import { filterModels, filtersToQuery, parseFilters, sortModels, variantTraits, type VariantTraits } from "@/lib/filters";
import { inStockFirst } from "@/lib/variants";
import { matchesSearch, searchTerms } from "@/lib/search";
import { getCategoryProducts, groupModels, type SearchParams } from "@/app/[category]/category-page";
import CategoryListing, { type ListingProduct, type ListingVariant } from "@/app/[category]/CategoryListing";

/**
 * /products — alle producten én zoekresultaten (?q=). Zelfde server-side
 * filters, kaarten en paginering als de categoriepagina's (lib/filters +
 * CategoryListing). Geen landingspagina: noindex, niet in de sitemap.
 * ?category=X → 308 naar /X (oude links).
 */

const PAGE_SIZE = 24;
const LISTING = { slug: "products", label: "Alle producten" } as const;

/** Alle DB-categorieën met een eigen route (umbrella's zijn alleen groeperingen). */
const ALL_DB_CATEGORIES = [...new Set(CATEGORIES.flatMap((c) => c.dbCategories))];

interface Props {
  searchParams: Promise<SearchParams>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Zoekterm uit ?q=, opgeschoond (max. 80 tekens, zoals /api/products). */
function readQuery(sp: SearchParams): string {
  return (first(sp.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = readQuery(await searchParams);
  return {
    title: q ? `Zoekresultaten voor “${q}”` : "Alle producten: het volledige assortiment",
    description: `Het volledige assortiment van ${businessInfo.name} in één overzicht: banken, eettafels, stoelen, kasten, bedden en verlichting. Filter op prijs, materiaal, kleur en maat.`,
    alternates: { canonical: "/products" },
    // Hulpmiddel, geen landingspagina: de categoriepagina's zijn canoniek.
    robots: { index: false, follow: true },
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams;

  // Oude links: ?category=X → canonieke categoriepagina.
  const category = first(sp.category);
  if (category) {
    const target = category === "alle-banken" ? "banken" : category;
    if (isCategorySlug(target)) permanentRedirect(`/${target}`);
  }

  const q = readQuery(sp);
  const terms = searchTerms(q);
  const filters = parseFilters(sp);
  const baseQuery = q ? new URLSearchParams({ q }).toString() : "";
  const query = [baseQuery, filtersToQuery(filters)].filter(Boolean).join("&");

  const rawPage = first(sp.page);
  const page = rawPage === undefined ? 1 : /^\d+$/.test(rawPage) ? Number(rawPage) : NaN;
  if (!Number.isFinite(page) || page < 1) notFound();

  const all = await getCategoryProducts(ALL_DB_CATEGORIES);
  // Zoeken per variant: een model blijft staan als minstens één uitvoering past.
  const matching = terms.length > 0 ? all.filter((p) => matchesSearch(p, terms)) : all;
  const { models, variants } = groupModels(matching);

  const traits = new Map<string, VariantTraits>(matching.map((p) => [p.id, variantTraits(p)]));
  const result = filterModels(
    models,
    (p) => traits.get(p.id) as VariantTraits,
    filters,
    (c) => getCategory(c)?.label ?? c,
  );
  const sorted = filters.sort === "aanbevolen" ? inStockFirst(result.models) : sortModels(result.models, filters.sort);

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  // Na een strenger filter kan de pagina niet meer bestaan → terug naar pagina 1.
  if (page > totalPages) redirect(query ? `/products?${query}` : "/products");

  const start = (page - 1) * PAGE_SIZE;
  const pageProducts: ListingProduct[] = sorted.slice(start, start + PAGE_SIZE);
  const pageVariants: Record<string, ListingVariant[]> = {};
  for (const p of pageProducts) {
    if (p.colorGroup && variants[p.colorGroup]) pageVariants[p.colorGroup] = variants[p.colorGroup];
  }

  const href = (n: number) => {
    const qs = new URLSearchParams(query);
    if (n > 1) qs.set("page", String(n));
    const s = qs.toString().replace(/%2C/gi, ",");
    return s ? `/products?${s}` : "/products";
  };

  return (
    <div className="pt-28 lg:pt-32 pb-20 lg:pb-28">
      <header className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-6 sm:mb-8 lg:mb-12">
        <p className="eyebrow mb-4">{q ? "Zoeken" : "Collectie"}</p>
        <h1 className="display-lg text-ink">{q ? `Resultaten voor “${q}”` : "Alle producten"}</h1>
      </header>

      <CategoryListing
        category={q ? { slug: LISTING.slug, label: `Zoeken: ${q}` } : LISTING}
        products={pageProducts}
        variants={pageVariants}
        page={page}
        pageSize={PAGE_SIZE}
        totalPages={totalPages}
        totalCount={totalCount}
        categoryCount={models.length}
        prevHref={page > 1 ? href(page - 1) : null}
        nextHref={page < totalPages ? href(page + 1) : null}
        query={query}
        filters={filters}
        facets={result.facets}
        priceOptions={result.priceOptions}
        inStockCount={result.inStockCount}
        baseQuery={baseQuery}
        empty={
          q
            ? {
                title: `Niets gevonden voor “${q}”`,
                text: "Probeer een ander woord (bijvoorbeeld ‘eettafel’ of ‘hoekbank’), haal een filter weg of bel ons: we denken graag mee.",
              }
            : undefined
        }
      />
    </div>
  );
}
