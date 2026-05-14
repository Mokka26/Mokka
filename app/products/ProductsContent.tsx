"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import FilterBar from "@/components/FilterBar";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
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

const categoryLabels: Record<string, string> = {
  banken: "Banken",
  hoekbanken: "Hoekbanken",
  bedden: "Bedden",
  matrassen: "Matrassen",
  slaapkamers: "Slaapkamers",
  kasten: "Kasten",
  tafels: "Tafels",
  eettafels: "Eettafels",
  salontafels: "Salontafels",
  bijzettafels: "Bijzettafels",
  "tv-meubels": "TV-meubels",
  "tafel-accessoires": "Tafel-accessoires",
  stoelen: "Stoelen",
  spiegels: "Spiegels",
  verlichting: "Verlichting",
};

const categoryIntros: Record<string, string> = {
  banken: "Het hart van elke woonkamer. Comfort en design, gemaakt voor het dagelijks leven.",
  hoekbanken: "Royale L-vorm modellen die de hoek van je woonkamer transformeren tot lounge.",
  bedden: "Slapen als ritueel. Boxsprings en bedframes voor diepe rust en stille ochtenden.",
  matrassen: "Pocketveer en koudschuim — de basis van elke goede nachtrust.",
  slaapkamers: "Rust begint hier. Zachte materialen en warme tinten voor de persoonlijkste ruimte.",
  kasten: "Meer dan opbergruimte — kasten als architectuur die je interieur structureren.",
  tafels: "Om de tafel wordt geleefd. Van eiken eettafels tot marmeren salontafels.",
  eettafels: "De plek waar dagen beginnen en eindigen. Eettafels in eik, marmer en steen.",
  salontafels: "Het middelpunt van de woonkamer — sculpturaal en functioneel.",
  bijzettafels: "Klein maar betekenisvol. Accentstukken voor naast de bank of bij het bed.",
  "tv-meubels": "Strakke lijnen voor het hart van je entertainmentruimte.",
  "tafel-accessoires": "Losse tafelbladen en onderdelen — marmer, sinter stone, glas.",
  stoelen: "Sculpturaal comfort. Stoelen die niet alleen zitten, maar een statement maken.",
  spiegels: "Wandsculpturen die ruimte verdiepen en licht vermenigvuldigen.",
  verlichting: "Sfeer maken begint bij licht. Hanglampen en plafondlampen met karakter.",
};

export default function ProductsContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [sortBy, setSortBy] = useState("newest");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(48);
  const PAGE_SIZE = 48;

  useEffect(() => {
    setCategory(searchParams.get("category") || "");
    setSearchQuery(searchParams.get("q") || "");
    // Reset extra filters bij categorie-wissel
    setSelectedColors([]);
    setSelectedMaterials([]);
    setSelectedDelivery([]);
    setInStockOnly(false);
    setDisplayedCount(PAGE_SIZE);
  }, [searchParams]);

  // Reset paging wanneer filter-state verandert
  useEffect(() => {
    setDisplayedCount(PAGE_SIZE);
  }, [category, sortBy, priceRange, searchQuery, selectedColors, selectedMaterials, selectedDelivery, inStockOnly]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (searchQuery) params.set("q", searchQuery);
      params.set("sort", sortBy);
      params.set("minPrice", priceRange[0].toString());
      params.set("maxPrice", priceRange[1].toString());
      const res = await fetch(`/api/products?${params.toString()}`);
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
    ? categoryLabels[category] || category
    : "De Collectie";
  const pageSubtitle = searchQuery
    ? `${filteredProducts.length} resultaten`
    : category
    ? categoryIntros[category] || ""
    : "Zorgvuldig geselecteerde meubels en interieur, voor het moderne thuis.";

  const eyebrowLabel = category ? "Categorie" : searchQuery ? "Zoeken" : "Collectie";

  return (
    <div className="pt-24 lg:pt-28 pb-24 lg:pb-32">
      {/* Slanke header — alleen breadcrumb + h1 (geen editorial intro) */}
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-6 lg:mb-8">
        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] font-medium text-stone mb-4">
          <Link href="/" className="hover:text-ink transition-colors duration-[280ms]">Home</Link>
          <span className="text-stone/40">/</span>
          <Link href="/products" className={`transition-colors duration-[280ms] ${!category ? "text-ink" : "hover:text-ink"}`}>
            Producten
          </Link>
          {category && (
            <>
              <span className="text-stone/40">/</span>
              <span className="text-ink">{categoryLabels[category] ?? category}</span>
            </>
          )}
          {searchQuery && (
            <>
              <span className="text-stone/40">/</span>
              <span className="text-ink">Zoekresultaten</span>
            </>
          )}
        </nav>

        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h1 className="display-sm text-ink">
            {pageTitle}
          </h1>
          <p className="eyebrow tabular-nums">
            {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "producten"}
          </p>
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-5 sm:gap-y-14 mt-8">
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
                    {visible.map((product) => (
                      <motion.div
                        key={product.id}
                        variants={{
                          hidden: { opacity: 0, y: 20 },
                          visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] } },
                        }}
                      >
                        <ProductCard product={product} variants={product.variants} />
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Paging */}
                  {hasMore ? (
                    <div className="flex flex-col items-center gap-3 mt-20 lg:mt-24">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-stone tabular-nums">
                        {visible.length} van {deduped.length}
                      </p>
                      <button
                        onClick={() => setDisplayedCount((c) => c + PAGE_SIZE)}
                        className="text-[11px] uppercase tracking-[0.25em] text-ink py-3.5 px-10 border border-ink hover:bg-ink hover:text-white transition-colors"
                      >
                        Toon meer
                      </button>
                    </div>
                  ) : deduped.length > PAGE_SIZE ? (
                    <div className="flex items-center justify-center gap-6 mt-20 lg:mt-24">
                      <div className="w-12 h-[1px] bg-line" />
                      <span className="text-[10px] uppercase tracking-[0.25em] text-stone">
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
