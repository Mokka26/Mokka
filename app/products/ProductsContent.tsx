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
}

const categoryLabels: Record<string, string> = {
  banken: "Banken",
  slaapkamers: "Slaapkamers",
  kasten: "Kasten",
  tafels: "Tafels",
  stoelen: "Stoelen",
};

const categoryIntros: Record<string, string> = {
  banken: "Het hart van elke woonkamer. Comfort en design, gemaakt voor het dagelijks leven.",
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

  return (
    <div className="pt-28 lg:pt-32 pb-20">
      {/* Editorial header */}
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-14 lg:mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end"
        >
          <div className="lg:col-span-8">
            <p className="eyebrow mb-4">
              {category ? "Categorie" : searchQuery ? "Zoeken" : "Collectie"}
            </p>
            <h1 className="display-lg text-ink leading-[1.05]">
              {pageTitle}
            </h1>
          </div>
          {pageSubtitle && (
            <div className="lg:col-span-4">
              <p className="text-stone text-base leading-relaxed max-w-md">{pageSubtitle}</p>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-[4/5] bg-bone animate-shimmer" />
                <div className="h-3 w-3/4 bg-bone animate-shimmer" />
                <div className="h-3 w-1/3 bg-bone animate-shimmer" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-32">
            <p className="display-md text-ink mb-4">Geen resultaten</p>
            <p className="text-stone max-w-md mx-auto mb-8">
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
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16"
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
          <div className="flex items-center justify-center gap-4 mt-20 text-stone text-[11px] uppercase tracking-[0.3em]">
            <div className="w-12 h-[1px] bg-line" />
            Einde van de collectie
            <div className="w-12 h-[1px] bg-line" />
          </div>
        )}
      </div>
    </div>
  );
}
