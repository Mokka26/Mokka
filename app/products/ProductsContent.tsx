"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import FilterBar from "@/components/FilterBar";

interface Product {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  images: string;
  featured: boolean;
  stock?: number;
  createdAt?: string | Date;
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  specs?: string | null;
}

interface ProductWithVariants extends Product {
  variants?: { slug: string; colorName: string | null; colorHex: string | null }[];
}

function dedupeByColorGroup(products: Product[]): ProductWithVariants[] {
  const groups = new Map<string, Product[]>();
  const standalone: Product[] = [];

  for (const p of products) {
    if (p.colorGroup) {
      const arr = groups.get(p.colorGroup) ?? [];
      arr.push(p);
      groups.set(p.colorGroup, arr);
    } else {
      standalone.push(p);
    }
  }

  const out: ProductWithVariants[] = [...standalone];
  for (const items of Array.from(groups.values())) {
    const primary = items[0];
    out.push({
      ...primary,
      variants: items.map((v: Product) => ({
        slug: v.slug,
        colorName: v.colorName ?? null,
        colorHex: v.colorHex ?? null,
      })),
    });
  }

  // Sorteer op originele volgorde — gebruik index in input array
  const orderMap = new Map(products.map((p, i) => [p.id, i]));
  out.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  return out;
}

import { getCategory } from "@/lib/categories";

const categoryLabels = (slug: string): string =>
  getCategory(slug)?.label ?? slug;
const categoryIntros = (slug: string): string =>
  getCategory(slug)?.intro ?? "";

const PAGE_SIZE = 48;

export default function ProductsContent({ initialProducts }: { initialProducts: Product[] }) {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [sortBy, setSortBy] = useState("newest");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);

  // URL-wissel (categorie/zoekterm) → filters resetten. Geen effect maar het
  // "state aanpassen tijdens render"-patroon uit de React-docs: vergelijk met
  // de vorige URL-sleutel en zet de state in dezelfde render (geen cascade).
  const paramsKey = `${searchParams.get("category") || ""}\u0000${searchParams.get("q") || ""}`;
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey);
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    setCategory(searchParams.get("category") || "");
    setSearchQuery(searchParams.get("q") || "");
    // Reset extra filters bij categorie-wissel
    setSelectedColors([]);
    setSelectedMaterials([]);
    setSelectedDelivery([]);
    setInStockOnly(false);
  }

  // Paging is afgeleid van de filter-state: het aantal getoonde kaarten hoort
  // bij één filter-combinatie. Wisselt die, dan begint de telling automatisch
  // weer bij PAGE_SIZE — zonder effect en zonder extra render.
  const filterKey = [
    category, sortBy, priceRange.join("-"), searchQuery,
    selectedColors.join(","), selectedMaterials.join(","), selectedDelivery.join(","), String(inStockOnly),
  ].join("|");
  const [paging, setPaging] = useState({ key: filterKey, count: PAGE_SIZE });
  const displayedCount = paging.key === filterKey ? paging.count : PAGE_SIZE;
  const showMore = () =>
    setPaging((p) => ({ key: filterKey, count: (p.key === filterKey ? p.count : PAGE_SIZE) + PAGE_SIZE }));

  // Eerste render gebruikt initialProducts (server-side, in de SSR-HTML).
  // Pas bij een filter-wijziging die de server raakt (categorie/sort/prijs/zoek)
  // halen we opnieuw op. De default-staat wordt al door initialProducts gedekt.
  const firstRun = useRef(true);
  useEffect(() => {
    const isDefault =
      !category && !searchQuery && sortBy === "newest" &&
      priceRange[0] === 0 && priceRange[1] === 5000;
    if (firstRun.current) {
      firstRun.current = false;
      if (isDefault) return;
    }
    const fetchProducts = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (searchQuery) params.set("q", searchQuery);
      params.set("sort", sortBy);
      params.set("minPrice", priceRange[0].toString());
      params.set("maxPrice", priceRange[1].toString());
      const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setProducts(data.products || []);
      setLoading(false);
    };
    fetchProducts();
  }, [category, sortBy, priceRange, searchQuery]);

  // Client-side filter: kleur / materiaal / levertijd / voorraad toepassen op fetched products
  const filteredProducts = products.filter((p) => {
    if (inStockOnly && (p.stock ?? 0) <= 0) return false;
    if (selectedColors.length > 0 && !selectedColors.includes(p.colorName ?? "")) return false;
    if (selectedMaterials.length > 0 || selectedDelivery.length > 0) {
      try {
        const specs = JSON.parse(p.specs ?? "{}");
        if (selectedMaterials.length > 0) {
          const matString: string = specs.Materiaal ?? "";
          const productMats = matString.split(/[,/]\s*/).map((s) => s.trim());
          if (!selectedMaterials.some((m) => productMats.includes(m))) return false;
        }
        if (selectedDelivery.length > 0 && !selectedDelivery.includes(specs.Levertijd ?? "")) return false;
      } catch {
        if (selectedMaterials.length > 0 || selectedDelivery.length > 0) return false;
      }
    }
    return true;
  });

  const pageTitle = searchQuery
    ? `Resultaten: "${searchQuery}"`
    : category
    ? categoryLabels(category) || category
    : "De Collectie";
  const pageSubtitle = searchQuery
    ? `${filteredProducts.length} resultaten`
    : category
    ? categoryIntros(category) || ""
    : "Zorgvuldig geselecteerde meubels en interieur, voor het moderne thuis.";

  const eyebrowLabel = category ? "Categorie" : searchQuery ? "Zoeken" : "Collectie";

  return (
    <div className="pt-24 lg:pt-28 pb-24 lg:pb-32">
      {/* Magazine sticky-moment header — asymmetric 12-col */}
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-8 lg:mb-16">
        <nav aria-label="Kruimelpad" className="flex flex-wrap items-center gap-x-2 eyebrow-lg mb-5">
          <Link href="/" className="inline-flex items-center min-h-11 hover:text-ink transition-colors duration-[280ms]">Home</Link>
          <span className="text-line-strong" aria-hidden="true">/</span>
          <Link href="/products" className={`inline-flex items-center min-h-11 transition-colors duration-[280ms] ${!category ? "text-ink" : "hover:text-ink"}`}>
            Producten
          </Link>
          {category && (
            <>
              <span className="text-line-strong" aria-hidden="true">/</span>
              <span className="text-ink">{categoryLabels(category) || category}</span>
            </>
          )}
          {searchQuery && (
            <>
              <span className="text-line-strong" aria-hidden="true">/</span>
              <span className="text-ink">Zoekresultaten</span>
            </>
          )}
        </nav>

        {/* Magazine-style asymmetric header — chapter label links, titel midden, count rechts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end">
          <div className="lg:col-span-2 flex lg:items-end">
            <span className="eyebrow text-accent">— {eyebrowLabel}</span>
          </div>
          <div className="lg:col-span-7">
            <h1 className="display-md text-ink">
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p className="mt-4 text-stone text-base lg:text-lg leading-[1.55] max-w-[55ch]">
                {pageSubtitle}
              </p>
            )}
          </div>
          <div className="lg:col-span-3 flex items-end justify-start lg:justify-end">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl text-ink tabular-nums [font-variation-settings:'opsz'_96]">
                {String(filteredProducts.length).padStart(2, "0")}
              </span>
              <span className="eyebrow text-stone">
                {filteredProducts.length === 1 ? "stuk" : "stuks"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <FilterBar
        category={category}
        onCategoryChange={setCategory}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        sortBy={sortBy}
        onSortChange={setSortBy}
        productCount={filteredProducts.length}
        selectedColors={selectedColors}
        onColorsChange={setSelectedColors}
        selectedMaterials={selectedMaterials}
        onMaterialsChange={setSelectedMaterials}
        selectedDelivery={selectedDelivery}
        onDeliveryChange={setSelectedDelivery}
        inStockOnly={inStockOnly}
        onInStockOnlyChange={setInStockOnly}
        productsForFacets={products}
      />

      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pb-24 lg:pb-0">
        <div>
            {loading ? (
              <div aria-busy="true" aria-label="Collectie laden" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-12 sm:gap-x-4 sm:gap-y-14">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-4">
                    <div className="aspect-square bg-white animate-shimmer" />
                    <div className="h-3 w-3/4 bg-bone animate-shimmer" />
                    <div className="h-3 w-1/3 bg-bone animate-shimmer" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-32 lg:py-40">
                <p className="eyebrow mb-6">Niets gevonden</p>
                <p className="display-md text-ink mb-6">Geen resultaten</p>
                <p className="body-lg text-slate max-w-md mx-auto mb-10">
                  We konden geen producten vinden die aan je zoekcriteria voldoen. Probeer je filters aan te passen.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCategory("");
                    setSearchQuery("");
                    setPriceRange([0, 5000]);
                    setSelectedColors([]);
                    setSelectedMaterials([]);
                    setSelectedDelivery([]);
                    setInStockOnly(false);
                  }}
                  className="btn-ghost"
                >
                  Filters Wissen
                </button>
              </div>
            ) : (() => {
              const deduped = dedupeByColorGroup(filteredProducts);
              const visible = deduped.slice(0, displayedCount);
              const hasMore = deduped.length > displayedCount;
              return (
                <>
                  <motion.div
                    key={`${category}-${sortBy}-${searchQuery}-${priceRange.join("-")}-${selectedColors.join(",")}-${selectedMaterials.join(",")}-${selectedDelivery.join(",")}`}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-5 sm:gap-y-14 mt-8"
                    initial="hidden"
                    animate="visible"
                    variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
                  >
                    {visible.map((product, i) => (
                      <motion.div
                        key={product.id}
                        variants={{
                          hidden: { opacity: 0, y: 20 },
                          visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] } },
                        }}
                      >
                        <ProductCard product={product} variants={product.variants} priority={i < 2} />
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Paging */}
                  {hasMore ? (
                    <div className="flex flex-col items-center gap-3 mt-20 lg:mt-24">
                      <p className="eyebrow-lg tabular-nums">
                        {visible.length} van {deduped.length}
                      </p>
                      <button
                        type="button"
                        onClick={showMore}
                        className="btn-ghost"
                      >
                        Toon meer
                      </button>
                    </div>
                  ) : deduped.length > PAGE_SIZE ? (
                    <div className="flex items-center justify-center gap-6 mt-20 lg:mt-24">
                      <div className="w-12 h-[1px] bg-line" />
                      <span className="eyebrow-lg">
                        Einde · {deduped.length} items
                      </span>
                      <div className="w-12 h-[1px] bg-line" />
                    </div>
                  ) : null}
                </>
              );
            })()}
        </div>
      </div>
    </div>
  );
}
