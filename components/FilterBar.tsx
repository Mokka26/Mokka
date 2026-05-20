"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface ProductForFilter {
  category: string;
  colorName?: string | null;
  colorHex?: string | null;
  specs?: string | null;
  stock?: number | null;
}

interface Props {
  category: string;
  onCategoryChange: (category: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  productCount: number;
  selectedColors?: string[];
  onColorsChange?: (colors: string[]) => void;
  selectedMaterials?: string[];
  onMaterialsChange?: (m: string[]) => void;
  selectedDelivery?: string[];
  onDeliveryChange?: (d: string[]) => void;
  inStockOnly?: boolean;
  onInStockOnlyChange?: (v: boolean) => void;
  productsForFacets?: ProductForFilter[];
}

interface SubCat { label: string; value: string }
interface Group { label: string; subs: SubCat[] }

const groups: Group[] = [
  { label: "Banken", subs: [
    { label: "Alle banken", value: "alle-banken" },
    { label: "Hoekbanken", value: "hoekbanken" },
    { label: "Bankstellen", value: "bankstellen" },
  ]},
  { label: "Tafels", subs: [
    { label: "Eettafels", value: "eettafels" },
    { label: "Salontafels", value: "salontafels" },
    { label: "Bijzettafels", value: "bijzettafels" },
    { label: "TV-meubels", value: "tv-meubels" },
    { label: "Overige tafels", value: "tafels" },
    { label: "Tafel-accessoires", value: "tafel-accessoires" },
  ]},
  { label: "Stoelen", subs: [{ label: "Eetkamerstoelen", value: "stoelen" }] },
  { label: "Slapen", subs: [
    { label: "Bedden", value: "bedden" },
    { label: "Matrassen", value: "matrassen" },
    { label: "Slaapkamers", value: "slaapkamers" },
  ]},
  { label: "Opbergen", subs: [{ label: "Kasten", value: "kasten" }] },
  { label: "Sfeer", subs: [
    { label: "Verlichting", value: "verlichting" },
    { label: "Spiegels", value: "spiegels" },
  ]},
];

const allSubs = groups.flatMap((g) => g.subs);
const findSubLabel = (v: string) => allSubs.find((s) => s.value === v)?.label;
const findGroupOf = (v: string) => groups.find((g) => g.subs.some((s) => s.value === v));

const sortOptions = [
  { label: "Aanbevolen", value: "newest" },
  { label: "Prijs: laag → hoog", value: "price-asc" },
  { label: "Prijs: hoog → laag", value: "price-desc" },
  { label: "Naam: A–Z", value: "name" },
];

// Universele filter-row
function FilterRow({
  label, count, active, onClick, indent = 0, swatch,
}: {
  label: string; count?: number; active: boolean;
  onClick: () => void; indent?: number; swatch?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative group w-full flex items-center justify-between py-2.5 text-left text-sm transition-colors ${
        active ? "text-ink font-medium" : "text-stone hover:text-ink"
      }`}
      style={{ paddingLeft: indent ? `${indent * 16}px` : undefined }}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 w-[2px] h-5 bg-accent transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
        style={{ left: indent ? `${indent * 16 - 12}px` : "-12px" }}
      />
      <span className="flex items-center gap-2.5">
        {swatch && (
          <span
            className="block w-5 h-5 rounded-full border border-line/80"
            style={{ backgroundColor: swatch }}
          />
        )}
        <span>{label}</span>
      </span>
      {typeof count === "number" && (
        <span className={`text-[10px] tabular-nums transition-opacity ${
          active ? "text-stone/80 opacity-100" : "text-stone/50 opacity-0 group-hover:opacity-100"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Section({
  title, defaultOpen = true, children,
}: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left group"
      >
        <span className="text-[11px] uppercase tracking-[0.2em] font-medium text-ink">
          {title}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone group-hover:text-ink transition-all duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 pl-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterContent(props: Props) {
  const {
    category, onCategoryChange,
    priceRange, onPriceRangeChange,
    selectedColors = [], onColorsChange,
    selectedMaterials = [], onMaterialsChange,
    selectedDelivery = [], onDeliveryChange,
    inStockOnly = false, onInStockOnlyChange,
    productsForFacets = [],
  } = props;

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [catExpanded, setCatExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (category) {
      const g = findGroupOf(category);
      if (g) set.add(g.label);
    }
    return set;
  });

  useEffect(() => {
    fetch("/api/products/counts", { cache: "no-store" }).then((r) => r.json()).then((d) => setCounts(d.counts ?? {})).catch(() => null);
  }, []);

  const toggleCatGroup = (label: string) => {
    setCatExpanded((p) => {
      const n = new Set(p);
      if (n.has(label)) n.delete(label); else n.add(label);
      return n;
    });
  };

  const groupCount = (g: Group) => g.subs.reduce((s, sub) => s + (counts[sub.value] ?? 0), 0);

  const facets = useMemo(() => {
    const colors = new Map<string, { hex: string; count: number }>();
    const materials = new Map<string, number>();
    const deliveries = new Map<string, number>();
    let stockCount = 0;
    for (const p of productsForFacets) {
      if ((p.stock ?? 0) > 0) stockCount++;
      if (p.colorName && p.colorHex) {
        const existing = colors.get(p.colorName);
        colors.set(p.colorName, { hex: p.colorHex, count: (existing?.count ?? 0) + 1 });
      }
      try {
        const specs = JSON.parse(p.specs ?? "{}");
        const mat = specs.Materiaal;
        if (mat) for (const m of mat.split(/[,/]\s*/)) materials.set(m.trim(), (materials.get(m.trim()) ?? 0) + 1);
        const del = specs.Levertijd;
        if (del) deliveries.set(del, (deliveries.get(del) ?? 0) + 1);
      } catch {}
    }
    return {
      colors: Array.from(colors.entries()).sort((a, b) => b[1].count - a[1].count),
      materials: Array.from(materials.entries()).sort((a, b) => b[1] - a[1]),
      deliveries: Array.from(deliveries.entries()).sort((a, b) => b[1] - a[1]),
      stockCount,
    };
  }, [productsForFacets]);

  const toggleArr = (arr: string[], val: string, setter?: (v: string[]) => void) => {
    if (!setter) return;
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  return (
    <div>
      <Section title="Categorie">
        <FilterRow
          label="Alle producten"
          count={counts._total ?? 0}
          active={!category}
          onClick={() => onCategoryChange("")}
        />
        {groups.map((g) => {
          const isExp = catExpanded.has(g.label);
          const hasActive = g.subs.some((s) => s.value === category);
          return (
            <div key={g.label}>
              <button
                onClick={() => toggleCatGroup(g.label)}
                className={`relative group w-full flex items-center justify-between py-2.5 text-left text-sm transition-colors ${
                  hasActive ? "text-ink font-medium" : "text-stone hover:text-ink"
                }`}
              >
                <span>{g.label}</span>
                <span className="flex items-center gap-2.5">
                  <span className={`text-[10px] tabular-nums transition-opacity ${
                    hasActive ? "text-stone/80 opacity-100" : "text-stone/50 opacity-0 group-hover:opacity-100"
                  }`}>
                    {groupCount(g)}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-stone/60 transition-transform ${isExp ? "rotate-180" : ""}`}
                    strokeWidth={1.5}
                  />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isExp && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.25, 0.4, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pb-1">
                      {g.subs.map((s) => (
                        <FilterRow
                          key={s.value}
                          label={s.label}
                          count={counts[s.value] ?? 0}
                          active={category === s.value}
                          onClick={() => onCategoryChange(s.value)}
                          indent={1}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </Section>

      <Section title="Prijs">
        <div className="font-serif text-base text-ink mb-4 tabular-nums">
          €{priceRange[0]} <span className="text-stone/40 mx-1">—</span> €{priceRange[1]}
        </div>
        <div className="space-y-4">
          <div>
            <label className="flex justify-between text-[10px] uppercase tracking-[0.15em] text-stone mb-1.5">
              <span>Min</span><span className="tabular-nums">€{priceRange[0]}</span>
            </label>
            <input type="range" min={0} max={5000} step={50} value={priceRange[0]}
              onChange={(e) => onPriceRangeChange([parseInt(e.target.value), priceRange[1]])}
              className="w-full accent-bronze h-1" />
          </div>
          <div>
            <label className="flex justify-between text-[10px] uppercase tracking-[0.15em] text-stone mb-1.5">
              <span>Max</span><span className="tabular-nums">€{priceRange[1]}</span>
            </label>
            <input type="range" min={0} max={5000} step={50} value={priceRange[1]}
              onChange={(e) => onPriceRangeChange([priceRange[0], parseInt(e.target.value)])}
              className="w-full accent-bronze h-1" />
          </div>
        </div>
      </Section>

      {facets.stockCount > 0 && onInStockOnlyChange && (
        <Section title="Voorraad">
          <FilterRow
            label="Alleen op voorraad"
            count={facets.stockCount}
            active={inStockOnly}
            onClick={() => onInStockOnlyChange(!inStockOnly)}
          />
        </Section>
      )}

      {facets.colors.length > 0 && onColorsChange && (
        <Section title="Kleur">
          {facets.colors.map(([name, { hex, count }]) => (
            <FilterRow
              key={name}
              label={name}
              count={count}
              active={selectedColors.includes(name)}
              onClick={() => toggleArr(selectedColors, name, onColorsChange)}
              swatch={hex}
            />
          ))}
        </Section>
      )}

      {facets.materials.length > 0 && onMaterialsChange && (
        <Section title="Materiaal" defaultOpen={false}>
          {facets.materials.map(([mat, count]) => (
            <FilterRow
              key={mat}
              label={mat}
              count={count}
              active={selectedMaterials.includes(mat)}
              onClick={() => toggleArr(selectedMaterials, mat, onMaterialsChange)}
            />
          ))}
        </Section>
      )}

      {facets.deliveries.length > 0 && onDeliveryChange && (
        <Section title="Levertijd" defaultOpen={false}>
          {facets.deliveries.map(([del, count]) => (
            <FilterRow
              key={del}
              label={del}
              count={count}
              active={selectedDelivery.includes(del)}
              onClick={() => toggleArr(selectedDelivery, del, onDeliveryChange)}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

// Desktop chip-bar: filter-pills in 1 rij, elk opent eigen popover
type ChipBarProps = Props & {
  sortOpen: boolean;
  setSortOpen: (o: boolean) => void;
  sortRef: React.RefObject<HTMLDivElement | null>;
  activeSortLabel?: string;
  hasActiveFilters: boolean;
  resetAll: () => void;
  activeCount: number;
};

function DesktopChipBar(props: ChipBarProps) {
  const {
    category, productCount,
    priceRange,
    selectedColors = [], selectedMaterials = [], selectedDelivery = [],
    inStockOnly = false, onInStockOnlyChange,
    sortBy, onSortChange,
    sortOpen, setSortOpen, sortRef, activeSortLabel,
    hasActiveFilters, resetAll, activeCount,
  } = props;

  const [openChip, setOpenChip] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const facets = useFacets(props.productsForFacets);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenChip(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const activeSubLabel = category ? findSubLabel(category) : null;

  type ChipKey = "categorie" | "prijs" | "kleur" | "materiaal" | "levertijd";

  interface ChipDef {
    key: ChipKey;
    label: string;
    count: number;
    active: boolean;
    summary?: string;
  }

  const chips: ChipDef[] = [
    {
      key: "categorie", label: "Categorie", count: category ? 1 : 0,
      active: !!category, summary: activeSubLabel ?? undefined,
    },
    {
      key: "prijs", label: "Prijs",
      count: priceRange[0] > 0 || priceRange[1] < 5000 ? 1 : 0,
      active: priceRange[0] > 0 || priceRange[1] < 5000,
      summary: (priceRange[0] > 0 || priceRange[1] < 5000) ? `€${priceRange[0]}–${priceRange[1]}` : undefined,
    },
    {
      key: "kleur", label: "Kleur", count: selectedColors.length,
      active: selectedColors.length > 0,
      summary: selectedColors.length === 1 ? selectedColors[0] : undefined,
    },
    {
      key: "materiaal", label: "Materiaal", count: selectedMaterials.length,
      active: selectedMaterials.length > 0,
      summary: selectedMaterials.length === 1 ? selectedMaterials[0] : undefined,
    },
    {
      key: "levertijd", label: "Levertijd", count: selectedDelivery.length,
      active: selectedDelivery.length > 0,
      summary: selectedDelivery.length === 1 ? selectedDelivery[0] : undefined,
    },
  ];

  // Filter out chips voor lege facets
  const visibleChips = chips.filter((c) => {
    if (c.key === "kleur") return facets.colors.length > 0;
    if (c.key === "materiaal") return facets.materials.length > 0;
    if (c.key === "levertijd") return facets.deliveries.length > 0;
    return true;
  });

  return (
    <div ref={barRef} className="hidden lg:block sticky top-24 z-30 bg-paper/95 backdrop-blur-md border-y border-line -mx-6 sm:-mx-10 lg:-mx-14 mb-10">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-6 min-h-14 py-2.5">
          {/* Filter chips in een rij — geen overflow-x-auto omdat dat de popovers verbergt */}
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            {visibleChips.map((chip) => (
              <div key={chip.key} className="relative flex-shrink-0">
                <button
                  onClick={() => setOpenChip(openChip === chip.key ? null : chip.key)}
                  className={`group/chip relative flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-medium px-5 py-2.5 border transition-all duration-[280ms] whitespace-nowrap ${
                    openChip === chip.key
                      ? "border-ink bg-ink text-paper"
                      : chip.active
                      ? "border-ink text-ink bg-paper"
                      : "border-line text-ink hover:border-ink"
                  }`}
                  style={{ borderRadius: "8px", transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                >
                  {/* SIGNATURE: hover-onderlijn-within (alleen inactive state) */}
                  {openChip !== chip.key && !chip.active && (
                    <span
                      className="absolute left-4 right-4 bottom-1.5 h-px bg-ink scale-x-0 group-hover/chip:scale-x-100 origin-right group-hover/chip:origin-left transition-transform duration-[480ms]"
                      style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                    />
                  )}
                  <span>{chip.label}</span>
                  {chip.summary && (
                    <span className={`normal-case tracking-normal text-xs ${
                      openChip === chip.key ? "text-paper/80" : "text-stone"
                    }`}>
                      · {chip.summary}
                    </span>
                  )}
                  {chip.count > 1 && (
                    <span className={`flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] tabular-nums font-medium ${
                      openChip === chip.key ? "bg-paper text-ink" : "bg-accent text-paper"
                    }`}>
                      {chip.count}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-[280ms] ${openChip === chip.key ? "rotate-180" : ""}`}
                    strokeWidth={1.5}
                  />
                </button>

                {/* Popover per chip */}
                <AnimatePresence>
                  {openChip === chip.key && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: [0.25, 0.4, 0.25, 1] }}
                      className="absolute left-0 top-full mt-2 bg-paper border border-line shadow-xl z-40 w-[320px] max-h-[60vh] overflow-y-auto"
                    >
                      <div className="px-5 py-4">
                        {chip.key === "categorie" && (
                          <CategoryPopover {...props} onAfterChange={() => setOpenChip(null)} />
                        )}
                        {chip.key === "prijs" && <PricePopover {...props} />}
                        {chip.key === "kleur" && <ColorPopover {...props} />}
                        {chip.key === "materiaal" && <MaterialPopover {...props} />}
                        {chip.key === "levertijd" && <DeliveryPopover {...props} />}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* Voorraad als toggle-chip (geen popover) */}
            {facets.stockCount > 0 && onInStockOnlyChange && (
              <button
                onClick={() => onInStockOnlyChange(!inStockOnly)}
                className={`group/voorraad relative flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-medium px-5 py-2.5 border transition-all duration-[280ms] whitespace-nowrap flex-shrink-0 ${
                  inStockOnly ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"
                }`}
                style={{ borderRadius: "8px", transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
              >
                {!inStockOnly && (
                  <span
                    className="absolute left-4 right-4 bottom-1.5 h-px bg-ink scale-x-0 group-hover/voorraad:scale-x-100 origin-right group-hover/voorraad:origin-left transition-transform duration-[480ms]"
                    style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                  />
                )}
                <span className={`w-1.5 h-1.5 ${inStockOnly ? "bg-accent" : "bg-stone/40"}`} />
                <span>Op voorraad</span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                onClick={resetAll}
                className="text-[10px] uppercase tracking-[0.22em] text-stone hover:text-ink underline underline-offset-4 decoration-stone/40 ml-2 whitespace-nowrap flex-shrink-0"
              >
                Wissen ({activeCount})
              </button>
            )}
          </div>

          {/* Count + Sort rechts */}
          <div className="flex items-center gap-5 flex-shrink-0">
            <p className="text-[11px] text-stone uppercase tracking-[0.15em] tabular-nums">
              {productCount} {productCount === 1 ? "item" : "items"}
            </p>
            <div ref={sortRef} className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-medium text-ink hover:text-accent transition-colors duration-[280ms]"
              >
                <ArrowUpDown className="w-3.5 h-3.5" strokeWidth={1.5} />
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
                    className="absolute right-0 top-full mt-2 w-60 bg-white border border-line shadow-xl overflow-hidden z-40"
                  >
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { onSortChange(opt.value); setSortOpen(false); }}
                        className={`w-full text-left text-[11px] uppercase tracking-[0.18em] px-5 py-3 transition-colors ${
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
      </div>
    </div>
  );
}

// Popover-inhoud per chip
function CategoryPopover({ category, onCategoryChange, onAfterChange }: Props & { onAfterChange?: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (category) { const g = findGroupOf(category); if (g) set.add(g.label); }
    return set;
  });
  useEffect(() => {
    fetch("/api/products/counts", { cache: "no-store" }).then((r) => r.json()).then((d) => setCounts(d.counts ?? {})).catch(() => null);
  }, []);
  const toggleGroup = (label: string) => setExpanded((p) => {
    const n = new Set(p); if (n.has(label)) n.delete(label); else n.add(label); return n;
  });
  const groupCount = (g: Group) => g.subs.reduce((s, sub) => s + (counts[sub.value] ?? 0), 0);
  const select = (v: string) => { onCategoryChange(v); onAfterChange?.(); };
  return (
    <div>
      <FilterRow label="Alle producten" count={counts._total ?? 0} active={!category} onClick={() => select("")} />
      {groups.map((g) => {
        const isExp = expanded.has(g.label);
        const hasActive = g.subs.some((s) => s.value === category);
        return (
          <div key={g.label}>
            <button
              onClick={() => toggleGroup(g.label)}
              className={`relative group w-full flex items-center justify-between py-2 text-left text-sm transition-colors ${
                hasActive ? "text-ink font-medium" : "text-stone hover:text-ink"
              }`}
            >
              <span>{g.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-[10px] text-stone/50 tabular-nums">{groupCount(g)}</span>
                <ChevronDown className={`w-3 h-3 text-stone/60 transition-transform ${isExp ? "rotate-180" : ""}`} strokeWidth={1.5} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isExp && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  {g.subs.map((s) => (
                    <FilterRow key={s.value} label={s.label} count={counts[s.value] ?? 0} active={category === s.value} onClick={() => select(s.value)} indent={1} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function PricePopover({ priceRange, onPriceRangeChange }: Props) {
  return (
    <div>
      <div className="font-serif text-base text-ink mb-3 tabular-nums">
        €{priceRange[0]} <span className="text-stone/40 mx-1">—</span> €{priceRange[1]}
      </div>
      <div className="space-y-4">
        <div>
          <label className="flex justify-between text-[10px] uppercase tracking-[0.15em] text-stone mb-1.5">
            <span>Min</span><span className="tabular-nums">€{priceRange[0]}</span>
          </label>
          <input type="range" min={0} max={5000} step={50} value={priceRange[0]}
            onChange={(e) => onPriceRangeChange([parseInt(e.target.value), priceRange[1]])}
            className="w-full accent-bronze h-1" />
        </div>
        <div>
          <label className="flex justify-between text-[10px] uppercase tracking-[0.15em] text-stone mb-1.5">
            <span>Max</span><span className="tabular-nums">€{priceRange[1]}</span>
          </label>
          <input type="range" min={0} max={5000} step={50} value={priceRange[1]}
            onChange={(e) => onPriceRangeChange([priceRange[0], parseInt(e.target.value)])}
            className="w-full accent-bronze h-1" />
        </div>
      </div>
    </div>
  );
}

function ColorPopover({ selectedColors = [], onColorsChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onColorsChange) return null;
  return (
    <div>
      {f.colors.map(([name, { hex, count }]) => (
        <FilterRow
          key={name} label={name} count={count} swatch={hex}
          active={selectedColors.includes(name)}
          onClick={() => onColorsChange(selectedColors.includes(name) ? selectedColors.filter((c) => c !== name) : [...selectedColors, name])}
        />
      ))}
    </div>
  );
}

function MaterialPopover({ selectedMaterials = [], onMaterialsChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onMaterialsChange) return null;
  return (
    <div>
      {f.materials.map(([mat, count]) => (
        <FilterRow
          key={mat} label={mat} count={count}
          active={selectedMaterials.includes(mat)}
          onClick={() => onMaterialsChange(selectedMaterials.includes(mat) ? selectedMaterials.filter((m) => m !== mat) : [...selectedMaterials, mat])}
        />
      ))}
    </div>
  );
}

function DeliveryPopover({ selectedDelivery = [], onDeliveryChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onDeliveryChange) return null;
  return (
    <div>
      {f.deliveries.map(([del, count]) => (
        <FilterRow
          key={del} label={del} count={count}
          active={selectedDelivery.includes(del)}
          onClick={() => onDeliveryChange(selectedDelivery.includes(del) ? selectedDelivery.filter((d) => d !== del) : [...selectedDelivery, del])}
        />
      ))}
    </div>
  );
}

// Desktop panel: secties naast elkaar in 4-koloms grid
function DesktopFilterPanel(props: Props) {
  return (
    <div className="grid grid-cols-4 gap-x-12 py-6">
      <div><CategorySectionInline {...props} /></div>
      <div>
        <PriceSectionInline {...props} />
        <StockSectionInline {...props} />
      </div>
      <div><ColorSectionInline {...props} /></div>
      <div>
        <MaterialSectionInline {...props} />
        <DeliverySectionInline {...props} />
      </div>
    </div>
  );
}

// Per-section inline (geen accordion wrapper — section is altijd zichtbaar in zijn kolom)
function InlineSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <h4 className="text-[11px] uppercase tracking-[0.22em] font-medium text-ink mb-3 pb-2 border-b border-line">
        {title}
      </h4>
      <div className="pl-3">{children}</div>
    </div>
  );
}

function CategorySectionInline({ category, onCategoryChange }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (category) { const g = findGroupOf(category); if (g) set.add(g.label); }
    return set;
  });
  useEffect(() => {
    fetch("/api/products/counts", { cache: "no-store" }).then((r) => r.json()).then((d) => setCounts(d.counts ?? {})).catch(() => null);
  }, []);
  const toggleGroup = (label: string) => setExpanded((p) => {
    const n = new Set(p); if (n.has(label)) n.delete(label); else n.add(label); return n;
  });
  const groupCount = (g: Group) => g.subs.reduce((s, sub) => s + (counts[sub.value] ?? 0), 0);
  return (
    <InlineSection title="Categorie">
      <FilterRow label="Alle producten" count={counts._total ?? 0} active={!category} onClick={() => onCategoryChange("")} />
      {groups.map((g) => {
        const isExp = expanded.has(g.label);
        const hasActive = g.subs.some((s) => s.value === category);
        return (
          <div key={g.label}>
            <button
              onClick={() => toggleGroup(g.label)}
              className={`relative group w-full flex items-center justify-between py-2 text-left text-sm transition-colors ${
                hasActive ? "text-ink font-medium" : "text-stone hover:text-ink"
              }`}
            >
              <span>{g.label}</span>
              <span className="flex items-center gap-2">
                <span className={`text-[10px] tabular-nums transition-opacity ${hasActive ? "text-stone/80 opacity-100" : "text-stone/50 opacity-0 group-hover:opacity-100"}`}>
                  {groupCount(g)}
                </span>
                <ChevronDown className={`w-3 h-3 text-stone/60 transition-transform ${isExp ? "rotate-180" : ""}`} strokeWidth={1.5} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isExp && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div>
                    {g.subs.map((s) => (
                      <FilterRow key={s.value} label={s.label} count={counts[s.value] ?? 0} active={category === s.value} onClick={() => onCategoryChange(s.value)} indent={1} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </InlineSection>
  );
}

function PriceSectionInline({ priceRange, onPriceRangeChange }: Props) {
  return (
    <InlineSection title="Prijs">
      <div className="font-serif text-base text-ink mb-3 tabular-nums">
        €{priceRange[0]} <span className="text-stone/40 mx-1">—</span> €{priceRange[1]}
      </div>
      <div className="space-y-3 pr-2">
        <div>
          <label className="flex justify-between text-[10px] uppercase tracking-[0.15em] text-stone mb-1">
            <span>Min</span><span className="tabular-nums">€{priceRange[0]}</span>
          </label>
          <input type="range" min={0} max={5000} step={50} value={priceRange[0]}
            onChange={(e) => onPriceRangeChange([parseInt(e.target.value), priceRange[1]])}
            className="w-full accent-bronze h-1" />
        </div>
        <div>
          <label className="flex justify-between text-[10px] uppercase tracking-[0.15em] text-stone mb-1">
            <span>Max</span><span className="tabular-nums">€{priceRange[1]}</span>
          </label>
          <input type="range" min={0} max={5000} step={50} value={priceRange[1]}
            onChange={(e) => onPriceRangeChange([priceRange[0], parseInt(e.target.value)])}
            className="w-full accent-bronze h-1" />
        </div>
      </div>
    </InlineSection>
  );
}

function useFacets(productsForFacets: ProductForFilter[] = []) {
  return useMemo(() => {
    const colors = new Map<string, { hex: string; count: number }>();
    const materials = new Map<string, number>();
    const deliveries = new Map<string, number>();
    let stockCount = 0;
    for (const p of productsForFacets) {
      if ((p.stock ?? 0) > 0) stockCount++;
      if (p.colorName && p.colorHex) {
        const existing = colors.get(p.colorName);
        colors.set(p.colorName, { hex: p.colorHex, count: (existing?.count ?? 0) + 1 });
      }
      try {
        const specs = JSON.parse(p.specs ?? "{}");
        const mat = specs.Materiaal;
        if (mat) for (const m of mat.split(/[,/]\s*/)) materials.set(m.trim(), (materials.get(m.trim()) ?? 0) + 1);
        const del = specs.Levertijd;
        if (del) deliveries.set(del, (deliveries.get(del) ?? 0) + 1);
      } catch {}
    }
    return {
      colors: Array.from(colors.entries()).sort((a, b) => b[1].count - a[1].count),
      materials: Array.from(materials.entries()).sort((a, b) => b[1] - a[1]),
      deliveries: Array.from(deliveries.entries()).sort((a, b) => b[1] - a[1]),
      stockCount,
    };
  }, [productsForFacets]);
}

function StockSectionInline({ inStockOnly = false, onInStockOnlyChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onInStockOnlyChange || f.stockCount === 0) return null;
  return (
    <InlineSection title="Voorraad">
      <FilterRow label="Alleen op voorraad" count={f.stockCount} active={inStockOnly} onClick={() => onInStockOnlyChange(!inStockOnly)} />
    </InlineSection>
  );
}

function ColorSectionInline({ selectedColors = [], onColorsChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onColorsChange || f.colors.length === 0) return null;
  return (
    <InlineSection title="Kleur">
      {f.colors.map(([name, { hex, count }]) => (
        <FilterRow
          key={name} label={name} count={count} swatch={hex}
          active={selectedColors.includes(name)}
          onClick={() => onColorsChange(selectedColors.includes(name) ? selectedColors.filter((c) => c !== name) : [...selectedColors, name])}
        />
      ))}
    </InlineSection>
  );
}

function MaterialSectionInline({ selectedMaterials = [], onMaterialsChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onMaterialsChange || f.materials.length === 0) return null;
  return (
    <InlineSection title="Materiaal">
      {f.materials.map(([mat, count]) => (
        <FilterRow
          key={mat} label={mat} count={count}
          active={selectedMaterials.includes(mat)}
          onClick={() => onMaterialsChange(selectedMaterials.includes(mat) ? selectedMaterials.filter((m) => m !== mat) : [...selectedMaterials, mat])}
        />
      ))}
    </InlineSection>
  );
}

function DeliverySectionInline({ selectedDelivery = [], onDeliveryChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onDeliveryChange || f.deliveries.length === 0) return null;
  return (
    <InlineSection title="Levertijd">
      {f.deliveries.map(([del, count]) => (
        <FilterRow
          key={del} label={del} count={count}
          active={selectedDelivery.includes(del)}
          onClick={() => onDeliveryChange(selectedDelivery.includes(del) ? selectedDelivery.filter((d) => d !== del) : [...selectedDelivery, del])}
        />
      ))}
    </InlineSection>
  );
}

export default function FilterBar(props: Props) {
  const {
    category, priceRange,
    sortBy, onSortChange,
    productCount,
    selectedColors = [],
    selectedMaterials = [],
    selectedDelivery = [],
  } = props;

  const [desktopPanelOpen, setDesktopPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile filter
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSortOpen(false); setDrawerOpen(false); setMobileSortOpen(false); setDesktopPanelOpen(false); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = (drawerOpen || mobileSortOpen) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen, mobileSortOpen]);

  const inStockOnly = props.inStockOnly ?? false;
  const activeCount =
    (category ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < 5000 ? 1 : 0) +
    selectedColors.length + selectedMaterials.length + selectedDelivery.length +
    (inStockOnly ? 1 : 0);
  const hasActiveFilters = activeCount > 0;
  const activeSubLabel = category ? findSubLabel(category) : null;
  const activeSortLabel = sortOptions.find((o) => o.value === sortBy)?.label;

  const resetAll = () => {
    props.onCategoryChange("");
    props.onPriceRangeChange([0, 5000]);
    props.onColorsChange?.([]);
    props.onMaterialsChange?.([]);
    props.onDeliveryChange?.([]);
    props.onInStockOnlyChange?.(false);
  };

  return (
    <>
      {/* Desktop: chip-row pattern — elke filter is een chip in 1 rij, klik opent popover */}
      <DesktopChipBar
        {...props}
        sortOpen={sortOpen}
        setSortOpen={setSortOpen}
        sortRef={sortRef}
        activeSortLabel={activeSortLabel}
        hasActiveFilters={hasActiveFilters}
        resetAll={resetAll}
        activeCount={activeCount}
      />

      {/* Mobile: floating sticky bottom bar */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-md border-t border-line"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch gap-px bg-line">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-paper text-[11px] uppercase tracking-[0.14em] font-medium text-ink hover:bg-bone transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
            Filter
            {hasActiveFilters && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 bg-accent text-paper text-[10px] font-medium tabular-nums">
                {activeCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileSortOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-paper text-[11px] uppercase tracking-[0.14em] font-medium text-ink hover:bg-bone transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" strokeWidth={1.5} />
            Sorteer
          </button>
        </div>
      </div>

      {/* Side drawer — filter inhoud, slide-in vanaf rechts (desktop + mobile) */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] bg-paper z-50 flex flex-col"
            >
              {/* SIGNATURE: linker rand-divider in accent kleur tijdens open-state */}
              <motion.span
                aria-hidden
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                exit={{ scaleY: 0 }}
                transition={{ duration: 0.64, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-0 top-0 bottom-0 w-px bg-accent origin-top z-10"
              />
              <div className="flex items-center justify-between px-7 py-6 border-b border-line">
                <div className="flex items-center gap-3">
                  <span className="eyebrow text-accent">— Filter</span>
                  {hasActiveFilters && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-accent text-paper text-[10px] font-medium tabular-nums">
                      {activeCount}
                    </span>
                  )}
                </div>
                <button onClick={() => setDrawerOpen(false)} className="p-1 -mr-1 text-stone hover:text-ink transition-colors duration-[280ms]" aria-label="Sluit">
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-7 pl-10 py-4">
                <FilterContent {...props} />
              </div>
              <div className="border-t border-line px-7 py-4 flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={resetAll}
                    className="text-[11px] uppercase tracking-[0.14em] font-medium text-stone hover:text-ink underline underline-offset-4 decoration-stone/40 transition-colors duration-[280ms]"
                  >
                    Wissen
                  </button>
                )}
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 bg-ink text-paper text-[11px] uppercase tracking-[0.14em] font-medium py-3.5 rounded-[10px] hover:bg-accent transition-colors duration-[280ms]"
                >
                  Toon {productCount} {productCount === 1 ? "item" : "items"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile sort sheet — slide-up sheet voor sorteer */}
      <AnimatePresence>
        {mobileSortOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileSortOpen(false)}
              className="lg:hidden fixed inset-0 bg-ink/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
              className="lg:hidden fixed bottom-0 inset-x-0 bg-paper z-50 rounded-t-2xl"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-line">
                <h3 className="text-[11px] uppercase tracking-[0.22em] font-medium text-ink">Sorteer</h3>
                <button onClick={() => setMobileSortOpen(false)} className="p-1" aria-label="Sluit">
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="py-2">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { onSortChange(opt.value); setMobileSortOpen(false); }}
                    className={`w-full text-left text-sm px-6 py-4 transition-colors ${
                      sortBy === opt.value ? "bg-bone text-ink font-medium" : "text-stone hover:bg-bone hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
