"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";
import { ChevronDown, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import { CATEGORIES, GROUP_ORDER } from "@/lib/categories";
import { Drawer } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

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

/* ─── Prijs ──────────────────────────────────────────────────────── */

// Bovengrens van het prijsfilter; [0, PRICE_MAX] = "geen prijsfilter"
// (ProductsContent gebruikt dezelfde default).
export const PRICE_MAX = 5000;

const PRICE_BUCKETS: ReadonlyArray<{ label: string; range: [number, number] }> = [
  { label: "Tot € 250", range: [0, 250] },
  { label: "€ 250 – € 500", range: [250, 500] },
  { label: "€ 500 – € 1.000", range: [500, 1000] },
  { label: "€ 1.000 – € 2.000", range: [1000, 2000] },
  { label: "€ 2.000 en meer", range: [2000, PRICE_MAX] },
];

const eur = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;

/** Prijsbereik zoals de chips/velden het leveren: [min, max], max = PRICE_MAX betekent "geen bovengrens". */
export type PriceRange = [number, number];

export const isDefaultPrice = (r: PriceRange) => r[0] <= 0 && r[1] >= PRICE_MAX;

/** Valt `price` binnen het bereik? Boven PRICE_MAX telt alles mee ("€ 2.000 en meer"). */
export function priceInRange(price: number, r: PriceRange): boolean {
  if (price < r[0]) return false;
  return r[1] >= PRICE_MAX || price <= r[1];
}

function priceSummary(r: [number, number]): string | undefined {
  if (isDefaultPrice(r)) return undefined;
  const bucket = PRICE_BUCKETS.find((b) => b.range[0] === r[0] && b.range[1] === r[1]);
  if (bucket) return bucket.label;
  if (r[1] >= PRICE_MAX) return `Vanaf ${eur(r[0])}`;
  if (r[0] <= 0) return `Tot ${eur(r[1])}`;
  return `${eur(r[0])} – ${eur(r[1])}`;
}

/* ─── Categorieën — afgeleid uit lib/categories.ts ───────────────── */

interface SubCat { label: string; value: string }
interface Group { label: string; subs: SubCat[] }

const groups: Group[] = GROUP_ORDER.map((group) => {
  const inGroup = CATEGORIES.filter((c) => c.group === group);
  const subs: SubCat[] = [];
  const umbrella = inGroup.find((c) => c.isUmbrella);
  // De API (/api/products) kent één umbrella-filter: "alle-banken".
  if (umbrella?.slug === "banken") subs.push({ label: umbrella.label, value: "alle-banken" });
  for (const c of inGroup) {
    if (!c.isUmbrella) subs.push({ label: c.label, value: c.slug });
  }
  // Producten die direct onder de umbrella-categorie in de DB staan
  // (bv. category = "tafels") blijven bereikbaar als "Overige …".
  if (umbrella && umbrella.slug !== "banken" && umbrella.dbCategories.includes(umbrella.slug)) {
    subs.push({ label: `Overige ${group.toLowerCase()}`, value: umbrella.slug });
  }
  return { label: group, subs };
});

const allSubs = groups.flatMap((g) => g.subs);
const findSubLabel = (v: string) => allSubs.find((s) => s.value === v)?.label;
const findGroupOf = (v: string) => groups.find((g) => g.subs.some((s) => s.value === v));

const sortOptions = [
  { label: "Aanbevolen", short: "Aanbevolen", value: "newest" },
  { label: "Prijs: laag naar hoog", short: "Prijs oplopend", value: "price-asc" },
  { label: "Prijs: hoog naar laag", short: "Prijs aflopend", value: "price-desc" },
  { label: "Naam: A tot Z", short: "Naam", value: "name" },
];

/* ─── Tellingen per categorie (één fetch, gedeeld) ───────────────── */

type Counts = Record<string, number>;

function isCountsResponse(d: unknown): d is { counts: Counts } {
  if (typeof d !== "object" || d === null || !("counts" in d)) return false;
  const counts = (d as { counts: unknown }).counts;
  if (typeof counts !== "object" || counts === null) return false;
  return Object.values(counts as Record<string, unknown>).every((v) => typeof v === "number");
}

let cachedCounts: Counts | null = null;

function useCategoryCounts(): { counts: Counts; failed: boolean } {
  const [counts, setCounts] = useState<Counts>(() => cachedCounts ?? {});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cachedCounts) return;
    const controller = new AbortController();
    (async () => {
      try {
        // Route krijgt s-maxage van de server; browser-cache mag gewoon meedoen.
        const res = await fetch("/api/products/counts", { cache: "default", signal: controller.signal });
        if (!res.ok) throw new Error(`counts ${res.status}`);
        const data: unknown = await res.json();
        if (!isCountsResponse(data)) throw new Error("counts: onverwacht antwoord");
        cachedCounts = data.counts;
        setCounts(data.counts);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFailed(true);
      }
    })();
    return () => controller.abort();
  }, []);

  return { counts, failed };
}

/* ─── Facetten uit specs (kleur / materiaal / levertijd) ─────────── */

function parseSpecs(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
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
      const specs = parseSpecs(p.specs);
      if (!specs) continue;
      const mat = specs.Materiaal;
      if (typeof mat === "string") {
        for (const part of mat.split(/[,/]\s*/)) {
          const key = part.trim();
          if (key) materials.set(key, (materials.get(key) ?? 0) + 1);
        }
      }
      const del = specs.Levertijd;
      if (typeof del === "string" && del.trim()) deliveries.set(del, (deliveries.get(del) ?? 0) + 1);
    }
    return {
      colors: Array.from(colors.entries()).sort((a, b) => b[1].count - a[1].count),
      materials: Array.from(materials.entries()).sort((a, b) => b[1] - a[1]),
      deliveries: Array.from(deliveries.entries()).sort((a, b) => b[1] - a[1]),
      stockCount,
    };
  }, [productsForFacets]);
}

const toggleIn = (arr: string[], val: string) =>
  arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

/* ─── Bouwstenen ─────────────────────────────────────────────────── */

/**
 * Toggle-chip (aria-pressed) met optionele teller — gedeeld met de
 * categoriepagina's (app/[category]/CategoryListing.tsx) zodat materiaal-,
 * type- en voorraadfilters er overal hetzelfde uitzien en werken.
 */
export function FilterChip({
  label, count, active, onClick, dot = false,
}: {
  label: string; count?: number; active: boolean; onClick: () => void;
  /** Groen bolletje vóór het label (voorraad-chip). */
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 min-h-11 px-4 rounded-full border text-sm font-medium transition-colors duration-[280ms] ${
        active ? "border-ink bg-ink text-paper" : "border-line-strong text-ink hover:border-ink hover:bg-bone"
      }`}
    >
      {dot && <span aria-hidden="true" className={`w-2 h-2 rounded-full ${active ? "bg-accent-light" : "bg-success"}`} />}
      <span>{label}</span>
      {typeof count === "number" && (
        <span className={`tabular-nums ${active ? "text-paper/85" : "text-stone"}`}>
          {count}
          <span className="sr-only"> producten</span>
        </span>
      )}
    </button>
  );
}

// Universele filter-rij: een toggle-knop met aria-pressed en teller.
function FilterRow({
  label, count, active, onClick, indent = false, swatch,
}: {
  label: string; count?: number; active: boolean;
  onClick: () => void; indent?: boolean; swatch?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative w-full flex items-center justify-between gap-3 py-2 min-h-11 text-left text-base transition-colors ${
        indent ? "pl-4" : ""
      } ${active ? "text-ink font-medium" : "text-slate hover:text-ink"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1/2 -translate-y-1/2 -left-3 w-[2px] h-5 bg-accent-dark transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      <span className="flex items-center gap-2.5">
        {swatch && (
          <span
            className="block w-5 h-5 rounded-full border border-line-strong"
            // Kleur komt uit de productdata (hex per variant) — enige
            // toegestane inline style: dynamische data, geen design-token.
            style={{ backgroundColor: swatch }}
            aria-hidden="true"
          />
        )}
        <span>{label}</span>
      </span>
      {typeof count === "number" && (
        <span className="text-sm text-stone tabular-nums">
          {count}
          <span className="sr-only"> producten</span>
        </span>
      )}
    </button>
  );
}

function Section({
  title, defaultOpen = true, children,
}: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="border-b border-line py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between min-h-11 text-left group"
      >
        <span className="eyebrow-lg text-ink">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-stone group-hover:text-ink transition-all duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2 pl-3">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Categorie-boom: groepen met uitklapbare subcategorieën.
function CategoryTree({
  category, onSelect, compact = false,
}: { category: string; onSelect: (v: string) => void; compact?: boolean }) {
  const { counts, failed } = useCategoryCounts();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    const g = category ? findGroupOf(category) : undefined;
    if (g) set.add(g.label);
    return set;
  });
  const toggleGroup = (label: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(label)) n.delete(label); else n.add(label);
      return n;
    });
  const show = (v: number | undefined) => (failed ? undefined : v ?? 0);
  const groupCount = (g: Group) => g.subs.reduce((s, sub) => s + (counts[sub.value] ?? 0), 0);

  return (
    <div>
      <FilterRow
        label="Alle producten"
        count={show(counts._total)}
        active={!category}
        onClick={() => onSelect("")}
      />
      {groups.map((g) => {
        const isExp = expanded.has(g.label);
        const hasActive = g.subs.some((s) => s.value === category);
        const panelId = `cat-${compact ? "pop" : "drawer"}-${g.label.toLowerCase()}`;
        return (
          <div key={g.label}>
            <button
              type="button"
              onClick={() => toggleGroup(g.label)}
              aria-expanded={isExp}
              aria-controls={panelId}
              className={`w-full flex items-center justify-between gap-3 py-2 min-h-11 text-left text-base transition-colors ${
                hasActive ? "text-ink font-medium" : "text-slate hover:text-ink"
              }`}
            >
              <span>{g.label}</span>
              <span className="flex items-center gap-2.5">
                {!failed && (
                  <span className="text-sm text-stone tabular-nums">
                    {groupCount(g)}
                    <span className="sr-only"> producten</span>
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-stone transition-transform ${isExp ? "rotate-180" : ""}`}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isExp && (
                <m.div
                  id={panelId}
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
                        count={show(counts[s.value])}
                        active={category === s.value}
                        onClick={() => onSelect(s.value)}
                        indent
                      />
                    ))}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Prijs: klassen als chips (aria-pressed) + optioneel eigen min/max.
 * Gedeeld met de categoriepagina's; `idPrefix` maakt de input-id's uniek
 * per plek (drawer, chip-paneel, categoriepagina).
 */
export function PriceFilter({ priceRange, onPriceRangeChange, idPrefix }: {
  priceRange: PriceRange;
  onPriceRangeChange: (r: PriceRange) => void;
  idPrefix: string;
}) {
  const [minText, setMinText] = useState(priceRange[0] > 0 ? String(priceRange[0]) : "");
  const [maxText, setMaxText] = useState(priceRange[1] < PRICE_MAX ? String(priceRange[1]) : "");

  // Externe wijziging (chip, "wissen") → velden mee laten lopen. Reset tijdens
  // render (React-patroon) i.p.v. setState in een effect.
  const [prevRange, setPrevRange] = useState(priceRange);
  if (prevRange[0] !== priceRange[0] || prevRange[1] !== priceRange[1]) {
    setPrevRange(priceRange);
    setMinText(priceRange[0] > 0 ? String(priceRange[0]) : "");
    setMaxText(priceRange[1] < PRICE_MAX ? String(priceRange[1]) : "");
  }

  const apply = () => {
    const min = Math.max(0, parseInt(minText.replace(/\D/g, ""), 10) || 0);
    const maxParsed = parseInt(maxText.replace(/\D/g, ""), 10);
    const max = Number.isFinite(maxParsed) && maxParsed > 0 ? Math.min(PRICE_MAX, maxParsed) : PRICE_MAX;
    onPriceRangeChange(min <= max ? [min, max] : [max, min]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Prijsklasse">
        {PRICE_BUCKETS.map((b) => {
          const active = priceRange[0] === b.range[0] && priceRange[1] === b.range[1];
          return (
            <button
              key={b.label}
              type="button"
              aria-pressed={active}
              onClick={() => onPriceRangeChange(active ? [0, PRICE_MAX] : b.range)}
              className={`inline-flex items-center min-h-11 px-4 rounded-full border text-sm font-medium transition-colors ${
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-line-strong text-ink hover:border-ink hover:bg-bone"
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); apply(); }}
        className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end"
        aria-label="Eigen prijsbereik"
      >
        <div>
          <label htmlFor={`${idPrefix}-min`} className="field-label text-sm mb-1">Van (€)</label>
          <input
            id={`${idPrefix}-min`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
            onBlur={apply}
            className="input-field tabular-nums"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-max`} className="field-label text-sm mb-1">Tot (€)</label>
          <input
            id={`${idPrefix}-max`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={String(PRICE_MAX)}
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
            onBlur={apply}
            className="input-field tabular-nums"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">Toepassen</Button>
      </form>
    </div>
  );
}

function ColorList({ selectedColors = [], onColorsChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onColorsChange) return null;
  return (
    <div>
      {f.colors.map(([name, { hex, count }]) => (
        <FilterRow
          key={name} label={name} count={count} swatch={hex}
          active={selectedColors.includes(name)}
          onClick={() => onColorsChange(toggleIn(selectedColors, name))}
        />
      ))}
    </div>
  );
}

function MaterialList({ selectedMaterials = [], onMaterialsChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onMaterialsChange) return null;
  return (
    <div>
      {f.materials.map(([mat, count]) => (
        <FilterRow
          key={mat} label={mat} count={count}
          active={selectedMaterials.includes(mat)}
          onClick={() => onMaterialsChange(toggleIn(selectedMaterials, mat))}
        />
      ))}
    </div>
  );
}

function DeliveryList({ selectedDelivery = [], onDeliveryChange, productsForFacets }: Props) {
  const f = useFacets(productsForFacets);
  if (!onDeliveryChange) return null;
  return (
    <div>
      {f.deliveries.map(([del, count]) => (
        <FilterRow
          key={del} label={del} count={count}
          active={selectedDelivery.includes(del)}
          onClick={() => onDeliveryChange(toggleIn(selectedDelivery, del))}
        />
      ))}
    </div>
  );
}

/* ─── Drawer-inhoud (mobiel) ─────────────────────────────────────── */

function FilterContent(props: Props) {
  const {
    category, onCategoryChange,
    priceRange, onPriceRangeChange,
    inStockOnly = false, onInStockOnlyChange,
    productsForFacets = [],
  } = props;
  const facets = useFacets(productsForFacets);

  return (
    <div>
      <Section title="Categorie">
        <CategoryTree category={category} onSelect={onCategoryChange} />
      </Section>

      <Section title="Prijs">
        <PriceFilter priceRange={priceRange} onPriceRangeChange={onPriceRangeChange} idPrefix="drawer-price" />
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

      {facets.colors.length > 0 && props.onColorsChange && (
        <Section title="Kleur"><ColorList {...props} /></Section>
      )}

      {facets.materials.length > 0 && props.onMaterialsChange && (
        <Section title="Materiaal" defaultOpen={false}><MaterialList {...props} /></Section>
      )}

      {facets.deliveries.length > 0 && props.onDeliveryChange && (
        <Section title="Levertijd" defaultOpen={false}><DeliveryList {...props} /></Section>
      )}
    </div>
  );
}

/* ─── Desktop chip-bar ───────────────────────────────────────────── */

type ChipKey = "categorie" | "prijs" | "kleur" | "materiaal" | "levertijd";

interface ChipDef {
  key: ChipKey;
  label: string;
  count: number;
  active: boolean;
  summary?: string;
}

type ChipBarProps = Props & {
  sortOpen: boolean;
  setSortOpen: (o: boolean) => void;
  sortRef: React.RefObject<HTMLDivElement | null>;
  activeSortLabel?: string;
  hasActiveFilters: boolean;
  resetAll: () => void;
  activeCount: number;
};

const chipBase =
  "relative flex items-center gap-2 min-h-11 px-4 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors duration-[280ms]";

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

  const [openChip, setOpenChip] = useState<ChipKey | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const facets = useFacets(props.productsForFacets);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenChip(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenChip(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const activeSubLabel = category ? findSubLabel(category) : undefined;
  const priceActive = !isDefaultPrice(priceRange);

  const chips: ChipDef[] = [
    { key: "categorie", label: "Categorie", count: category ? 1 : 0, active: !!category, summary: activeSubLabel },
    { key: "prijs", label: "Prijs", count: priceActive ? 1 : 0, active: priceActive, summary: priceSummary(priceRange) },
    { key: "kleur", label: "Kleur", count: selectedColors.length, active: selectedColors.length > 0, summary: selectedColors.length === 1 ? selectedColors[0] : undefined },
    { key: "materiaal", label: "Materiaal", count: selectedMaterials.length, active: selectedMaterials.length > 0, summary: selectedMaterials.length === 1 ? selectedMaterials[0] : undefined },
    { key: "levertijd", label: "Levertijd", count: selectedDelivery.length, active: selectedDelivery.length > 0, summary: selectedDelivery.length === 1 ? selectedDelivery[0] : undefined },
  ];

  const visibleChips = chips.filter((c) => {
    if (c.key === "kleur") return facets.colors.length > 0;
    if (c.key === "materiaal") return facets.materials.length > 0;
    if (c.key === "levertijd") return facets.deliveries.length > 0;
    return true;
  });

  return (
    <div ref={barRef} className="hidden lg:block sticky top-24 z-30 bg-paper/95 backdrop-blur-md border-y border-line -mx-6 sm:-mx-10 lg:-mx-14 mb-10">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-6 min-h-16 py-2.5">
          {/* Filter chips — elk opent een eigen paneel (disclosure-patroon) */}
          <div className="flex items-center gap-2 flex-1 flex-wrap" role="group" aria-label="Filters">
            {visibleChips.map((chip) => {
              const isOpen = openChip === chip.key;
              const panelId = `filter-panel-${chip.key}`;
              return (
                <div key={chip.key} className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenChip(isOpen ? null : chip.key)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className={`${chipBase} ${
                      isOpen
                        ? "border-ink bg-ink text-paper"
                        : chip.active
                        ? "border-ink text-ink bg-paper"
                        : "border-line-strong text-ink hover:border-ink hover:bg-bone"
                    }`}
                  >
                    <span>{chip.label}</span>
                    {chip.summary && (
                      <span className={`font-normal ${isOpen ? "text-paper/85" : "text-stone"}`}>
                        · {chip.summary}
                      </span>
                    )}
                    {chip.count > 1 && (
                      <span className={`flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[13px] tabular-nums font-medium ${
                        isOpen ? "bg-paper text-ink" : "bg-ink text-paper"
                      }`}>
                        {chip.count}
                        <span className="sr-only"> geselecteerd</span>
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-[280ms] ${isOpen ? "rotate-180" : ""}`}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <m.div
                        id={panelId}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease: [0.25, 0.4, 0.25, 1] }}
                        className="absolute left-0 top-full mt-2 bg-paper border border-line rounded-[12px] shadow-xl z-40 w-[360px] max-h-[60dvh] overflow-y-auto"
                      >
                        <div className="px-5 py-4">
                          {chip.key === "categorie" && (
                            <CategoryTree
                              compact
                              category={category}
                              onSelect={(v) => { props.onCategoryChange(v); setOpenChip(null); }}
                            />
                          )}
                          {chip.key === "prijs" && (
                            <PriceFilter priceRange={priceRange} onPriceRangeChange={props.onPriceRangeChange} idPrefix="chip-price" />
                          )}
                          {chip.key === "kleur" && <ColorList {...props} />}
                          {chip.key === "materiaal" && <MaterialList {...props} />}
                          {chip.key === "levertijd" && <DeliveryList {...props} />}
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Voorraad als toggle-chip (geen paneel) */}
            {facets.stockCount > 0 && onInStockOnlyChange && (
              <button
                type="button"
                onClick={() => onInStockOnlyChange(!inStockOnly)}
                aria-pressed={inStockOnly}
                className={`${chipBase} flex-shrink-0 ${
                  inStockOnly ? "border-ink bg-ink text-paper" : "border-line-strong text-ink hover:border-ink hover:bg-bone"
                }`}
              >
                <span aria-hidden="true" className={`w-2 h-2 rounded-full ${inStockOnly ? "bg-accent-light" : "bg-success"}`} />
                <span>Op voorraad</span>
              </button>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetAll} className="flex-shrink-0 underline underline-offset-4">
                Wis filters ({activeCount})
              </Button>
            )}
          </div>

          {/* Teller + sorteren rechts */}
          <div className="flex items-center gap-5 flex-shrink-0">
            <p className="text-sm text-stone tabular-nums" aria-live="polite" aria-atomic="true">
              {productCount} {productCount === 1 ? "product" : "producten"}
            </p>
            <div ref={sortRef} className="relative">
              <button
                type="button"
                onClick={() => setSortOpen(!sortOpen)}
                aria-expanded={sortOpen}
                aria-controls="sort-menu"
                className="inline-flex items-center gap-2 min-h-11 px-2 text-sm font-medium text-ink hover:text-accent-dark transition-colors duration-[280ms]"
              >
                <ArrowUpDown className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
                <span>
                  <span className="sr-only">Sorteren: </span>
                  {activeSortLabel ?? "Sorteer"}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${sortOpen ? "rotate-180" : ""}`} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <m.div
                    id="sort-menu"
                    role="group"
                    aria-label="Sorteervolgorde"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white border border-line rounded-[12px] shadow-xl overflow-hidden z-40"
                  >
                    {sortOptions.map((opt) => {
                      const pressed = sortBy === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={pressed}
                          onClick={() => { onSortChange(opt.value); setSortOpen(false); }}
                          className={`w-full text-left text-base min-h-11 px-5 py-2.5 transition-colors ${
                            pressed ? "bg-ink text-paper" : "text-ink hover:bg-bone"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────── */

export default function FilterBar(props: Props) {
  const {
    category, priceRange,
    sortBy, onSortChange,
    productCount,
    selectedColors = [],
    selectedMaterials = [],
    selectedDelivery = [],
  } = props;

  const [drawerOpen, setDrawerOpen] = useState(false); // mobiel filterpaneel
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const inStockOnly = props.inStockOnly ?? false;
  const activeCount =
    (category ? 1 : 0) +
    (isDefaultPrice(priceRange) ? 0 : 1) +
    selectedColors.length + selectedMaterials.length + selectedDelivery.length +
    (inStockOnly ? 1 : 0);
  const hasActiveFilters = activeCount > 0;
  const activeSort = sortOptions.find((o) => o.value === sortBy);

  const resetAll = () => {
    props.onCategoryChange("");
    props.onPriceRangeChange([0, PRICE_MAX]);
    props.onColorsChange?.([]);
    props.onMaterialsChange?.([]);
    props.onDeliveryChange?.([]);
    props.onInStockOnlyChange?.(false);
  };

  const countLabel = `${productCount} ${productCount === 1 ? "product" : "producten"}`;

  return (
    <>
      {/* Desktop: chip-rij — elke filter is een chip, klik opent een paneel */}
      <DesktopChipBar
        {...props}
        sortOpen={sortOpen}
        setSortOpen={setSortOpen}
        sortRef={sortRef}
        activeSortLabel={activeSort?.short}
        hasActiveFilters={hasActiveFilters}
        resetAll={resetAll}
        activeCount={activeCount}
      />

      {/* Mobiel: vaste balk onderaan */}
      <div className="lg:hidden fixed inset-x-0 bottom-[var(--cookie-banner-h,0px)] z-40 bg-paper/95 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch gap-px bg-line">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-controls="filter-drawer"
            className="flex-1 flex items-center justify-center gap-2 min-h-14 bg-paper text-sm font-medium uppercase tracking-[0.08em] text-ink hover:bg-bone transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            Filter
            {hasActiveFilters && (
              <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-ink text-paper text-[13px] font-medium tabular-nums">
                {activeCount}
                <span className="sr-only"> actieve filters</span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileSortOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={mobileSortOpen}
            aria-controls="sort-sheet"
            className="flex-1 flex items-center justify-center gap-2 min-h-14 bg-paper text-sm font-medium uppercase tracking-[0.08em] text-ink hover:bg-bone transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            Sorteer
          </button>
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{countLabel}</p>
      </div>

      {/* Filterpaneel — native dialog vanaf rechts */}
      <Drawer
        id="filter-drawer"
        side="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={hasActiveFilters ? `Filter (${activeCount})` : "Filter"}
        footer={
          <div className="px-6 py-4 flex items-center gap-3">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetAll} className="underline underline-offset-4">
                Wissen
              </Button>
            )}
            <Button onClick={() => setDrawerOpen(false)} className="flex-1">
              Toon {countLabel}
            </Button>
          </div>
        }
      >
        <div className="px-6 pl-9 py-2">
          <FilterContent {...props} />
        </div>
      </Drawer>

      {/* Sorteren — sheet van onderen (mobiel) */}
      <Drawer
        id="sort-sheet"
        side="bottom"
        open={mobileSortOpen}
        onClose={() => setMobileSortOpen(false)}
        title="Sorteer"
        className="rounded-t-2xl"
      >
        <div className="py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" role="group" aria-label="Sorteervolgorde">
          {sortOptions.map((opt) => {
            const pressed = sortBy === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={pressed}
                onClick={() => { onSortChange(opt.value); setMobileSortOpen(false); }}
                className={`w-full text-left text-base min-h-12 px-6 py-3 transition-colors ${
                  pressed ? "bg-bone text-ink font-medium" : "text-ink hover:bg-bone"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Drawer>
    </>
  );
}
