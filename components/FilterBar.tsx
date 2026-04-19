"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  category: string;
  onCategoryChange: (category: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  productCount: number;
}

const categories = [
  { label: "Alles", value: "" },
  { label: "Banken", value: "banken" },
  { label: "Slaapkamers", value: "slaapkamers" },
  { label: "Kasten", value: "kasten" },
  { label: "Tafels", value: "tafels" },
  { label: "Stoelen", value: "stoelen" },
];

const sortOptions = [
  { label: "Nieuwste", value: "newest" },
  { label: "Prijs: laag → hoog", value: "price-asc" },
  { label: "Prijs: hoog → laag", value: "price-desc" },
  { label: "Naam: A–Z", value: "name" },
];

export default function FilterBar({
  category,
  onCategoryChange,
  priceRange,
  onPriceRangeChange,
  sortBy,
  onSortChange,
  productCount,
}: Props) {
  const [priceOpen, setPriceOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const priceRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (priceRef.current && !priceRef.current.contains(e.target as Node)) setPriceOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasActiveFilters = category !== "" || priceRange[0] > 0 || priceRange[1] < 5000;
  const activeSortLabel = sortOptions.find((o) => o.value === sortBy)?.label;

  return (
    <div className="sticky top-24 lg:top-28 z-30 bg-paper/95 backdrop-blur-md border-y border-line mb-10 lg:mb-14 -mx-6 sm:-mx-10 lg:-mx-14 px-6 sm:px-10 lg:px-14">
      <div className="flex items-center justify-between py-4 gap-4">
        {/* Links: categorieën desktop, filter button mobile */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Desktop: categorie pills */}
          <div className="hidden lg:flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => onCategoryChange(cat.value)}
                className={`text-[11px] uppercase tracking-[0.2em] px-4 py-2 transition-colors whitespace-nowrap ${
                  category === cat.value
                    ? "bg-ink text-white"
                    : "text-stone hover:text-ink"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Mobile: filter button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink py-2 px-3 border border-line"
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-bronze" />}
          </button>
        </div>

        {/* Rechts: aantal + prijs + sort */}
        <div className="flex items-center gap-2 lg:gap-3">
          <p className="hidden sm:block text-[11px] text-stone uppercase tracking-[0.15em]">
            {productCount} {productCount === 1 ? "product" : "producten"}
          </p>

          {/* Prijs dropdown — desktop only */}
          <div ref={priceRef} className="hidden lg:block relative">
            <button
              onClick={() => { setPriceOpen(!priceOpen); setSortOpen(false); }}
              className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink py-2 px-3 border border-line hover:border-ink transition-colors"
            >
              Prijs
              <ChevronDown className={`w-3 h-3 transition-transform ${priceOpen ? "rotate-180" : ""}`} strokeWidth={1.5} />
            </button>
            <AnimatePresence>
              {priceOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-72 bg-white border border-line p-5 shadow-lg"
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-stone mb-4">
                    &euro;{priceRange[0]} — &euro;{priceRange[1]}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-stone">Minimum</label>
                      <input type="range" min={0} max={5000} step={100} value={priceRange[0]} onChange={(e) => onPriceRangeChange([parseInt(e.target.value), priceRange[1]])} className="w-full accent-bronze h-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone">Maximum</label>
                      <input type="range" min={0} max={5000} step={100} value={priceRange[1]} onChange={(e) => onPriceRangeChange([priceRange[0], parseInt(e.target.value)])} className="w-full accent-bronze h-1" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sort dropdown */}
          <div ref={sortRef} className="relative">
            <button
              onClick={() => { setSortOpen(!sortOpen); setPriceOpen(false); }}
              className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink py-2 px-3 border border-line hover:border-ink transition-colors"
            >
              <span className="hidden sm:inline">Sorteer:</span>
              <span>{activeSortLabel?.split(":")[0] ?? "Sorteer"}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${sortOpen ? "rotate-180" : ""}`} strokeWidth={1.5} />
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-white border border-line shadow-lg overflow-hidden"
                >
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { onSortChange(opt.value); setSortOpen(false); }}
                      className={`w-full text-left text-[11px] uppercase tracking-[0.15em] px-4 py-3 transition-colors ${
                        sortBy === opt.value ? "bg-ink text-white" : "text-stone hover:bg-bone hover:text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <span className="text-[10px] text-stone uppercase tracking-[0.2em]">Actieve filters:</span>
          {category && (
            <button
              onClick={() => onCategoryChange("")}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] bg-ink text-white px-3 py-1.5 hover:bg-bronze transition-colors"
            >
              {categories.find((c) => c.value === category)?.label}
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          )}
          {(priceRange[0] > 0 || priceRange[1] < 5000) && (
            <button
              onClick={() => onPriceRangeChange([0, 5000])}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] bg-ink text-white px-3 py-1.5 hover:bg-bronze transition-colors"
            >
              &euro;{priceRange[0]} — &euro;{priceRange[1]}
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          )}
          <button
            onClick={() => { onCategoryChange(""); onPriceRangeChange([0, 5000]); }}
            className="text-[10px] uppercase tracking-[0.2em] text-stone hover:text-ink underline underline-offset-2 ml-2"
          >
            Alles wissen
          </button>
        </div>
      )}

      {/* Mobile filters dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="lg:hidden overflow-hidden border-t border-line"
          >
            <div className="py-6 space-y-6">
              <div>
                <p className="text-[11px] text-stone uppercase tracking-[0.2em] mb-3">Categorie</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => onCategoryChange(cat.value)}
                      className={`text-[11px] uppercase tracking-[0.15em] px-3 py-2 transition-colors ${
                        category === cat.value ? "bg-ink text-white" : "bg-bone text-stone"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-stone uppercase tracking-[0.2em] mb-3">
                  Prijs: &euro;{priceRange[0]} — &euro;{priceRange[1]}
                </p>
                <div className="space-y-2">
                  <input type="range" min={0} max={5000} step={100} value={priceRange[0]} onChange={(e) => onPriceRangeChange([parseInt(e.target.value), priceRange[1]])} className="w-full accent-bronze h-1" />
                  <input type="range" min={0} max={5000} step={100} value={priceRange[1]} onChange={(e) => onPriceRangeChange([priceRange[0], parseInt(e.target.value)])} className="w-full accent-bronze h-1" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
