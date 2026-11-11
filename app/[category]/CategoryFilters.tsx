"use client";

/**
 * Filter-UI voor de categoriepagina's. Geen eigen filterstaat: elke keuze gaat
 * via `onChange` naar de URL en de server levert het resultaat + tellingen
 * (zie lib/filters.ts). Desktop: rij met uitklapknoppen; mobiel: lade met
 * inklapbare secties.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Drawer } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { swatchBackground } from "@/lib/variants";
import {
  activeChips,
  activeFilterCount,
  parsePrice,
  priceLabel,
  SORT_OPTIONS,
  type ActiveFilters,
  type Facet,
  type FacetOption,
  type MultiFacetKey,
  type PriceRange,
  type SortKey,
} from "@/lib/filters";

interface FilterProps {
  filters: ActiveFilters;
  facets: Facet[];
  priceOptions: FacetOption[];
  inStockCount: number;
  onChange: (next: ActiveFilters) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────

function toggleValue(f: ActiveFilters, key: MultiFacetKey, value: string): ActiveFilters {
  const cur = f.multi[key];
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  return { ...f, multi: { ...f.multi, [key]: next } };
}

function setPrice(f: ActiveFilters, value: string | null): ActiveFilters {
  return { ...f, prijs: value ? parsePrice(value) : null };
}

/** Teller als tekst + verborgen woord voor screenreaders. */
function Count({ n }: { n: number }) {
  return (
    <span className="ml-auto pl-3 text-base text-graphite tabular-nums">
      {n}
      <span className="sr-only"> producten</span>
    </span>
  );
}

// ─── Opties ─────────────────────────────────────────────────────────

/** Lijst met echte checkboxes (meerdere keuzes binnen één filter). */
function OptionList({
  facet,
  filters,
  onChange,
}: {
  facet: Facet;
  filters: ActiveFilters;
  onChange: (next: ActiveFilters) => void;
}) {
  return (
    <ul className="list-none m-0 p-0">
      {facet.options.map((o) => {
        const swatch = facet.key === "kleur" ? swatchBackground(o.hex ?? null) : undefined;
        return (
          <li key={o.value}>
            <label className="flex items-center gap-3 min-h-11 px-3 rounded-[8px] cursor-pointer text-base text-ink hover:bg-bone">
              <input
                type="checkbox"
                checked={o.selected}
                onChange={() => onChange(toggleValue(filters, facet.key, o.value))}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex items-center justify-center w-5 h-5 shrink-0 rounded-[4px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 ${
                  o.selected ? "bg-ink border-ink" : "border-line-strong bg-white"
                }`}
              >
                {o.selected && <Check className="w-3.5 h-3.5 text-paper" strokeWidth={2.5} />}
              </span>
              {swatch && (
                // Kleur uit lib/filters (gevalideerd door swatchBackground): dynamische data, geen design-token.
                <span aria-hidden="true" className="w-5 h-5 shrink-0 rounded-full border border-line-strong" style={swatch} />
              )}
              <span>{o.label}</span>
              <Count n={o.count} />
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** Prijsklassen (één keuze) + eigen bedrag. Bedrag wordt toegepast bij Enter of bij verlaten van het veld. */
function PriceOptions({
  options,
  filters,
  onChange,
  idPrefix,
}: {
  options: FacetOption[];
  filters: ActiveFilters;
  onChange: (next: ActiveFilters) => void;
  idPrefix: string;
}) {
  const current = filters.prijs;
  const [minText, setMinText] = useState(current && current.min > 0 ? String(current.min) : "");
  const [maxText, setMaxText] = useState(current?.max !== undefined ? String(current.max) : "");

  // Externe wijziging (klasse, chip, wissen) → velden mee laten lopen (reset tijdens render).
  const [prev, setPrev] = useState<PriceRange | null>(current);
  if (prev?.min !== current?.min || prev?.max !== current?.max) {
    setPrev(current);
    setMinText(current && current.min > 0 ? String(current.min) : "");
    setMaxText(current?.max !== undefined ? String(current.max) : "");
  }

  const applyCustom = () => {
    const min = parseInt(minText.replace(/\D/g, ""), 10);
    const max = parseInt(maxText.replace(/\D/g, ""), 10);
    const hasMin = Number.isFinite(min) && min > 0;
    const hasMax = Number.isFinite(max) && max > 0;
    const value = hasMin || hasMax ? `${hasMin ? min : 0}-${hasMax ? max : ""}` : null;
    const next = setPrice(filters, value);
    if (next.prijs?.min === current?.min && next.prijs?.max === current?.max) return;
    onChange(next);
  };

  return (
    <div>
      <ul className="list-none m-0 p-0">
        {options.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              aria-pressed={o.selected}
              disabled={o.count === 0 && !o.selected}
              onClick={() => onChange(setPrice(filters, o.selected ? null : o.value))}
              className="w-full flex items-center gap-3 min-h-11 px-3 rounded-[8px] text-left text-base text-ink hover:bg-bone disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <span
                aria-hidden="true"
                className={`flex items-center justify-center w-5 h-5 shrink-0 rounded-full border ${
                  o.selected ? "border-ink" : "border-line-strong bg-white"
                }`}
              >
                {o.selected && <span className="w-2.5 h-2.5 rounded-full bg-ink" />}
              </span>
              <span>{o.label}</span>
              <Count n={o.count} />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyCustom();
        }}
        className="grid grid-cols-2 gap-3 px-3 pt-4 mt-2 border-t border-line"
        aria-label="Eigen prijs"
      >
        <div>
          <label htmlFor={`${idPrefix}-min`} className="block text-base text-graphite mb-1">
            Van €
          </label>
          <input
            id={`${idPrefix}-min`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
            onBlur={applyCustom}
            className="input-field tabular-nums"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-max`} className="block text-base text-graphite mb-1">
            Tot €
          </label>
          <input
            id={`${idPrefix}-max`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Geen max"
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
            onBlur={applyCustom}
            className="input-field tabular-nums"
          />
        </div>
        {/* Enter in een veld past het bedrag toe. */}
        <button type="submit" className="sr-only">
          Prijs toepassen
        </button>
      </form>
    </div>
  );
}

function StockToggle({
  filters,
  inStockCount,
  onChange,
}: {
  filters: ActiveFilters;
  inStockCount: number;
  onChange: (next: ActiveFilters) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={filters.voorraad}
      onClick={() => onChange({ ...filters, voorraad: !filters.voorraad })}
      className={`inline-flex items-center gap-2.5 min-h-11 px-4 rounded-full border text-base transition-colors ${
        filters.voorraad ? "border-ink bg-ink text-paper" : "border-line-strong text-ink hover:border-ink hover:bg-bone"
      }`}
    >
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${filters.voorraad ? "bg-paper" : "bg-success"}`} />
      <span>Op voorraad</span>
      <span className={`tabular-nums ${filters.voorraad ? "text-paper" : "text-graphite"}`}>
        {inStockCount}
        <span className="sr-only"> producten</span>
      </span>
    </button>
  );
}

// ─── Desktop: rij met uitklapknoppen ────────────────────────────────

function Popover({
  label,
  selectedCount,
  open,
  onOpenChange,
  wide = false,
  children,
}: {
  label: string;
  selectedCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onOpenChange(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const active = selectedCount > 0;
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className={`inline-flex items-center gap-2 min-h-11 pl-4 pr-3 rounded-full border text-base text-ink transition-colors ${
          active || open ? "border-ink" : "border-line-strong hover:border-ink"
        } ${open ? "bg-bone" : "hover:bg-bone"}`}
      >
        <span>{label}</span>
        {active && (
          <span className="min-w-6 h-6 inline-flex items-center justify-center rounded-full bg-ink text-paper text-sm tabular-nums px-1.5">
            {selectedCount}
            <span className="sr-only"> gekozen</span>
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className={`absolute left-0 top-full mt-2 z-30 ${wide ? "w-80" : "w-72"} max-h-[60vh] overflow-y-auto rounded-[12px] border border-line bg-paper p-2 shadow-[0_18px_40px_-12px_rgba(20,17,13,0.25)]`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function FilterToolbar({ filters, facets, priceOptions, inStockCount, onChange }: FilterProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openChange = (key: string) => (open: boolean) => setOpenKey((cur) => (open ? key : cur === key ? null : cur));
  const typeFacet = facets.find((f) => f.key === "type");
  const rest = facets.filter((f) => f.key !== "type");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {typeFacet && (
        <Popover
          label={typeFacet.label}
          selectedCount={filters.multi.type.length}
          open={openKey === "type"}
          onOpenChange={openChange("type")}
        >
          <OptionList facet={typeFacet} filters={filters} onChange={onChange} />
        </Popover>
      )}
      <Popover
        label="Prijs"
        selectedCount={filters.prijs ? 1 : 0}
        open={openKey === "prijs"}
        onOpenChange={openChange("prijs")}
        wide
      >
        <PriceOptions options={priceOptions} filters={filters} onChange={onChange} idPrefix="toolbar-prijs" />
      </Popover>
      {rest.map((facet) => (
        <Popover
          key={facet.key}
          label={facet.label}
          selectedCount={filters.multi[facet.key].length}
          open={openKey === facet.key}
          onOpenChange={openChange(facet.key)}
        >
          <OptionList facet={facet} filters={filters} onChange={onChange} />
        </Popover>
      ))}
      <StockToggle filters={filters} inStockCount={inStockCount} onChange={onChange} />
    </div>
  );
}

// ─── Sorteren ───────────────────────────────────────────────────────

export function SortSelect({ value, onChange }: { value: SortKey; onChange: (sort: SortKey) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-3 shrink-0">
      <label htmlFor={id} className="hidden sm:inline text-base text-graphite">
        Sorteren
      </label>
      <select
        id={id}
        value={value}
        aria-label="Sorteren"
        onChange={(e) => onChange(SORT_OPTIONS.find((o) => o.value === e.target.value)?.value ?? "aanbevolen")}
        className="min-h-11 bg-transparent border border-line-strong rounded-full pl-4 pr-9 py-2 text-ink text-base hover:border-ink focus:border-ink"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Gekozen filters ────────────────────────────────────────────────

export function ActiveFilterChips({
  filters,
  facets,
  onChange,
  onClear,
}: {
  filters: ActiveFilters;
  facets: Facet[];
  onChange: (next: ActiveFilters) => void;
  onClear: () => void;
}) {
  const chips = activeChips(filters, facets);
  return (
    <ul className="flex flex-wrap items-center gap-2 list-none m-0 p-0" aria-label="Gekozen filters">
      {chips.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={() => onChange(c.without)}
            className="inline-flex items-center gap-2 min-h-11 pl-4 pr-3 rounded-full bg-bone text-ink text-base hover:bg-line transition-colors"
          >
            <span>{c.label}</span>
            <X aria-hidden="true" strokeWidth={1.75} className="w-4 h-4" />
            <span className="sr-only">filter weghalen</span>
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={onClear} className="btn-link min-h-11 px-2">
          Alles wissen
        </button>
      </li>
    </ul>
  );
}

// ─── Mobiel: lade met secties ───────────────────────────────────────

function DrawerSection({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-line">
      <summary className="flex items-center gap-3 min-h-14 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="text-[17px] font-medium text-ink shrink-0">{title}</span>
        {summary && <span className="text-base text-graphite truncate">{summary}</span>}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className="ml-auto w-5 h-5 shrink-0 text-ink transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="pb-4 -mx-3">{children}</div>
    </details>
  );
}

export function FilterDrawer({
  id,
  open,
  onClose,
  resultLabel,
  isPending,
  onClear,
  filters,
  facets,
  priceOptions,
  inStockCount,
  onChange,
}: FilterProps & {
  id: string;
  open: boolean;
  onClose: () => void;
  resultLabel: string;
  isPending: boolean;
  onClear: () => void;
}) {
  const count = activeFilterCount(filters);
  const typeFacet = facets.find((f) => f.key === "type");
  const rest = facets.filter((f) => f.key !== "type");
  const selectedLabels = (facet: Facet) =>
    facet.options
      .filter((o) => o.selected)
      .map((o) => o.label)
      .join(", ") || undefined;

  return (
    <Drawer
      id={id}
      side="bottom"
      open={open}
      onClose={onClose}
      title={count > 0 ? `Filteren (${count})` : "Filteren"}
      className="rounded-t-2xl"
      footer={
        <div className="px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-3">
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear} className="underline underline-offset-4">
              Alles wissen
            </Button>
          )}
          <Button onClick={onClose} className="flex-1">
            <span aria-live="polite">{isPending ? "Bezig…" : `Toon ${resultLabel}`}</span>
          </Button>
        </div>
      }
    >
      <div className="px-6 py-2">
        <div className="py-4 border-b border-line">
          <StockToggle filters={filters} inStockCount={inStockCount} onChange={onChange} />
        </div>
        {typeFacet && (
          <DrawerSection title={typeFacet.label} summary={selectedLabels(typeFacet)} defaultOpen>
            <OptionList facet={typeFacet} filters={filters} onChange={onChange} />
          </DrawerSection>
        )}
        <DrawerSection
          title="Prijs"
          summary={filters.prijs ? priceLabel(filters.prijs) : undefined}
          defaultOpen={!typeFacet}
        >
          <PriceOptions options={priceOptions} filters={filters} onChange={onChange} idPrefix="sheet-prijs" />
        </DrawerSection>
        {rest.map((facet) => (
          <DrawerSection
            key={facet.key}
            title={facet.label}
            summary={selectedLabels(facet)}
            defaultOpen={facet.options.some((o) => o.selected)}
          >
            <OptionList facet={facet} filters={filters} onChange={onChange} />
          </DrawerSection>
        ))}
      </div>
    </Drawer>
  );
}
