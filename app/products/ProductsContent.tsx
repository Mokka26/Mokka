"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
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
}

const categoryLabels: Record<string, string> = {
  banken: "Banken",
  bedden: "Bedden",
  slaapkamers: "Slaapkamers",
  kasten: "Kasten",
  tafels: "Tafels",
  stoelen: "Stoelen",
};

const categoryIntros: Record<string, string> = {
  banken: "Het hart van elke woonkamer. Comfort en design, gemaakt voor het dagelijks leven.",
  bedden: "Slapen als ritueel. Boxsprings en bedframes voor diepe rust en stille ochtenden.",
  slaapkamers: "Rust begint hier. Zachte materialen en warme tinten voor de persoonlijkste ruimte.",
  kasten: "Meer dan opbergruimte — kasten als architectuur die je interieur structureren.",
  tafels: "Om de tafel wordt geleefd. Van eiken eettafels tot marmeren salontafels.",
  stoelen: "Sculpturaal comfort. Stoelen die niet alleen zitten, maar een statement maken.",
};

export default function ProductsContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [sortBy, setSortBy] = useState("newest");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setCategory(searchParams.get("category") || "");
    setSearchQuery(searchParams.get("q") || "");
  }, [searchParams]);

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

  const pageTitle = searchQuery
    ? `Resultaten: "${searchQuery}"`
    : category
    ? categoryLabels[category] || category
    : "De Collectie";
  const pageSubtitle = searchQuery
    ? `${products.length} resultaten`
    : category
    ? categoryIntros[category] || ""
    : "Zorgvuldig geselecteerde meubels en interieur, voor het moderne thuis.";

  const eyebrowLabel = category ? "Categorie" : searchQuery ? "Zoeken" : "Collectie";

  return (
    <div className="pt-32 lg:pt-40 pb-28 lg:pb-40">
      {/* Editorial header */}
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-16 lg:mb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end"
        >
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-serif italic text-stone text-sm">— 01</span>
              <span className="eyebrow">{eyebrowLabel}</span>
            </div>
            <h1 className="display-xl text-ink">
              {pageTitle}
            </h1>
          </div>
          {pageSubtitle && (
            <div className="lg:col-span-4">
              <p className="body-lg text-slate max-w-md">{pageSubtitle}</p>
            </div>
          )}
        </motion.div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        {/* Sticky filter bar */}
        <FilterBar
          category={category}
          onCategoryChange={setCategory}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          sortBy={sortBy}
          onSortChange={setSortBy}
          productCount={products.length}
        />

        {/* Product grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-14 sm:gap-x-6 sm:gap-y-20">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-[4/5] bg-bone animate-shimmer" />
                <div className="h-3 w-3/4 bg-bone animate-shimmer" />
                <div className="h-3 w-1/3 bg-bone animate-shimmer" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
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
              }}
              className="btn-ghost"
            >
              Filters Wissen
            </button>
          </div>
        ) : (
          <motion.div
            key={`${category}-${sortBy}-${searchQuery}-${priceRange.join("-")}`}
            className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-14 sm:gap-x-6 sm:gap-y-20"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {products.map((product) => (
              <motion.div
                key={product.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] } },
                }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Einde indicator */}
        {!loading && products.length > 0 && (
          <div className="flex items-center justify-center gap-6 mt-24 lg:mt-32">
            <div className="w-16 h-[1px] bg-line" />
            <span className="eyebrow">Einde van de collectie</span>
            <div className="w-16 h-[1px] bg-line" />
          </div>
        )}
      </div>
    </div>
  );
}
