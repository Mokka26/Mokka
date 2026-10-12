"use client";

import Link from "next/link";
import Image from "next/image";
import { useId, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Star, Edit3, Eye, EyeOff, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { parsePrice } from "@/lib/parse-price";
import { formatPrice } from "@/components/ui/price";
import { updateProductInline } from "./actions";
import BulkActions from "./BulkActions";
import { PRODUCT_SORT_LABEL, type ProductSort } from "../_lib/product-filters";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  featured: boolean;
  hidden: boolean;
  source: string | null;
  thumb: string | null;
  updatedAt: string;
  stock: number;
};

type Props = {
  products: ProductRow[];
  categories: string[];
  sort: ProductSort;
  dir: "asc" | "desc";
  sortHrefs: Record<string, string>;
};

// md+: raster met vaste kolommen; <md: gestapelde kaart (zelfde DOM).
const GRID = "md:grid md:grid-cols-[2.75rem_3.5rem_minmax(0,1fr)_7.5rem_6rem_5.5rem_5.5rem_3rem] md:items-center md:gap-x-3";

const dt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });

export default function ProductsTable({ products, categories, sort, dir, sortHrefs }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllId = useId();

  const selected = useMemo(
    () => products.filter((p) => selectedIds.has(p.id)).map((p) => ({ id: p.id, name: p.name, price: p.price })),
    [products, selectedIds],
  );
  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  const clear = () => setSelectedIds(new Set());

  if (products.length === 0) {
    return (
      <div className="bg-white border border-line py-20 text-center">
        <p className="text-base text-stone">Geen producten gevonden voor dit filter.</p>
      </div>
    );
  }

  return (
    <div>
      <BulkActions selected={selected} categories={categories} onDone={clear} onClear={clear} />

      <div role="table" aria-label="Producten" className="bg-white border border-line">
        <div role="rowgroup" className="hidden md:block">
          <div role="row" className={`${GRID} bg-bone border-b border-line px-4 py-2`}>
            <div role="columnheader" className="flex items-center justify-center">
              <input
                id={selectAllId}
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Alle producten op deze pagina selecteren"
                className="w-5 h-5 accent-accent"
              />
            </div>
            <div role="columnheader" />
            <SortHeader col="name" sort={sort} dir={dir} href={sortHrefs.name} />
            <SortHeader col="price" sort={sort} dir={dir} href={sortHrefs.price} className="justify-end" />
            <SortHeader col="stock" sort={sort} dir={dir} href={sortHrefs.stock} className="justify-end" />
            <Th className="text-center">Uitgelicht</Th>
            <Th className="text-center">Zichtbaar</Th>
            <Th />
          </div>
        </div>
        <div role="rowgroup" className="divide-y divide-line">
          {products.map((p) => (
            <ProductRowView key={p.id} product={p} selected={selectedIds.has(p.id)} onToggle={() => toggle(p.id)} />
          ))}
        </div>
      </div>

      <p className="md:hidden text-sm text-stone mt-3">
        Sorteren: {PRODUCT_SORT_LABEL[sort]} ({dir === "asc" ? "oplopend" : "aflopend"}) — pas aan via het filter hierboven.
      </p>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div role="columnheader" className={`text-[10px] uppercase tracking-[0.2em] text-stone ${className}`}>
      {children}
    </div>
  );
}

function SortHeader({
  col,
  sort,
  dir,
  href,
  className = "",
}: {
  col: ProductSort;
  sort: ProductSort;
  dir: "asc" | "desc";
  href: string;
  className?: string;
}) {
  const active = sort === col;
  return (
    <div role="columnheader" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={`flex ${className}`}>
      <Link
        href={href}
        className={`inline-flex items-center gap-1 min-h-9 text-[10px] uppercase tracking-[0.2em] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          active ? "text-ink" : "text-stone"
        }`}
      >
        {PRODUCT_SORT_LABEL[col]}
        {active && (dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </Link>
    </div>
  );
}

function ProductRowView({ product, selected, onToggle }: { product: ProductRow; selected: boolean; onToggle: () => void }) {
  const [featured, setFeatured] = useState(product.featured);
  const [hidden, setHidden] = useState(product.hidden);
  const [pending, startTransition] = useTransition();

  const toggleFeatured = () => {
    const next = !featured;
    setFeatured(next);
    startTransition(async () => {
      const res = await updateProductInline({ id: product.id, featured: next });
      if (!res.ok) {
        setFeatured(!next);
        toast.error(res.error);
      }
    });
  };

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    startTransition(async () => {
      const res = await updateProductInline({ id: product.id, hidden: next });
      if (!res.ok) {
        setHidden(!next);
        toast.error(res.error, { duration: 8000 });
      }
    });
  };

  const iconBtn =
    "inline-flex items-center justify-center w-11 h-11 hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors disabled:opacity-50";

  return (
    <div role="row" aria-selected={selected} className={`${GRID} px-3 md:px-4 py-3 ${selected ? "bg-accent/5" : ""}`}>
      {/* Rij 1 op mobiel: selectie, foto, naam, bewerken */}
      <div className="flex items-start gap-3 md:contents">
        <div role="cell" className="flex items-center justify-center min-h-11 md:min-h-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`${product.name} selecteren`}
            className="w-5 h-5 accent-accent"
          />
        </div>
        <div role="cell">
          {product.thumb ? (
            <div className="w-12 h-12 relative bg-bone overflow-hidden">
              <Image src={product.thumb} alt="" fill className="object-cover" sizes="48px" />
            </div>
          ) : (
            <div className="w-12 h-12 bg-bone flex items-center justify-center" title="Geen foto">
              <ImageOff className="w-4 h-4 text-stone" aria-label="Geen foto" />
            </div>
          )}
        </div>
        <div role="cell" className="min-w-0 flex-1">
          <Link
            href={`/admin/products/${product.slug}`}
            className="text-base text-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent block truncate"
          >
            {product.name}
          </Link>
          <p className="text-sm text-stone truncate">
            <span className="capitalize">{product.category}</span>
            {product.source ? ` · ${product.source}` : ""}
            <span className="hidden lg:inline"> · bijgewerkt {dt.format(new Date(product.updatedAt))}</span>
          </p>
        </div>
        <div role="cell" className="md:order-last text-right">
          <Link
            href={`/admin/products/${product.slug}`}
            className={`${iconBtn} text-stone hover:text-ink`}
            aria-label={`${product.name} bewerken`}
          >
            <Edit3 className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Rij 2 op mobiel: prijs, voorraad, uitgelicht, zichtbaar */}
      <div className="mt-2 flex items-center justify-between gap-2 pl-[3.5rem] md:pl-0 md:mt-0 md:contents">
        <div role="cell" className="md:text-right">
          <PriceCell id={product.id} initial={product.price} name={product.name} />
        </div>
        <div role="cell" className="md:text-right">
          <StockCell id={product.id} initial={product.stock} name={product.name} />
        </div>
        <div role="cell" className="text-center">
          <button
            type="button"
            onClick={toggleFeatured}
            disabled={pending}
            aria-pressed={featured}
            aria-label={featured ? `${product.name}: niet meer uitlichten` : `${product.name}: uitlichten`}
            title={featured ? "Uitgelicht — klik om uit te zetten" : "Uitlichten op de homepage"}
            className={iconBtn}
          >
            <Star className={`w-4 h-4 ${featured ? "fill-accent text-accent" : "text-stone"}`} />
          </button>
        </div>
        <div role="cell" className="text-center">
          <button
            type="button"
            onClick={toggleHidden}
            disabled={pending}
            aria-pressed={!hidden}
            aria-label={hidden ? `${product.name}: zichtbaar maken (nu verborgen)` : `${product.name}: verbergen (nu zichtbaar)`}
            title={hidden ? "Verborgen — klik om zichtbaar te maken" : "Zichtbaar — klik om te verbergen"}
            className={iconBtn}
          >
            {hidden ? <EyeOff className="w-4 h-4 text-stone" /> : <Eye className="w-4 h-4 text-success" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline cellen ───────────────────────────────────────────────────

const inlineInput =
  "min-h-11 px-2 py-1 text-base border border-accent bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent text-right tabular-nums";

function StockCell({ id, initial, name }: { id: string; initial: number; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(initial));
  const [current, setCurrent] = useState(initial);
  const [pending, startTransition] = useTransition();

  const commit = () => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      toast.error(`Voorraad van ${name}: vul een geheel getal van 0 of hoger in.`);
      setValue(String(current));
      setEditing(false);
      return;
    }
    const n = Number(trimmed);
    if (n === current) {
      setEditing(false);
      return;
    }
    setEditing(false);
    startTransition(async () => {
      const res = await updateProductInline({ id, stock: n });
      if (res.ok) {
        setCurrent(n);
        setValue(String(n));
      } else {
        toast.error(`Voorraad van ${name} niet opgeslagen: ${res.error}`);
        setValue(String(current));
      }
    });
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(String(current));
            setEditing(false);
          }
        }}
        aria-label={`Voorraad van ${name}`}
        className={`${inlineInput} w-20`}
        type="text"
        inputMode="numeric"
      />
    );
  }

  const color = current === 0 ? "text-error" : current <= 3 ? "text-accent-dark" : "text-ink";

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      aria-label={`Voorraad van ${name}: ${current}. Klik om te bewerken`}
      title="Klik om te bewerken"
      className={`inline-flex items-center gap-1.5 min-h-11 px-2 hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${pending ? "opacity-50" : ""}`}
    >
      <span className={`text-base tabular-nums ${color}`}>{current}</span>
      <Edit3 className="w-3 h-3 text-stone" aria-hidden="true" />
    </button>
  );
}

function PriceCell({ id, initial, name }: { id: string; initial: number; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial.toFixed(2).replace(".", ","));
  const [current, setCurrent] = useState(initial);
  const [pending, startTransition] = useTransition();

  const reset = () => setValue(current.toFixed(2).replace(".", ","));

  const commit = () => {
    const parsed = parsePrice(value);
    if (parsed.error || parsed.value == null) {
      toast.error(`Prijs van ${name}: ${parsed.error ?? "vul een prijs in"}`);
      reset();
      setEditing(false);
      return;
    }
    const n = parsed.value;
    if (Math.abs(n - current) < 0.001) {
      setEditing(false);
      return;
    }
    setEditing(false);
    startTransition(async () => {
      const res = await updateProductInline({ id, price: n });
      if (res.ok) {
        setCurrent(n);
        setValue(n.toFixed(2).replace(".", ","));
      } else {
        toast.error(`Prijs van ${name} niet opgeslagen: ${res.error}`);
        reset();
      }
    });
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-base text-stone">€</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              reset();
              setEditing(false);
            }
          }}
          aria-label={`Verkoopprijs incl. btw van ${name}`}
          inputMode="decimal"
          className={`${inlineInput} w-24 font-serif`}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      aria-label={`Prijs van ${name}: ${formatPrice(current)}. Klik om te bewerken`}
      title="Klik om te bewerken"
      className={`inline-flex items-center gap-1.5 min-h-11 px-2 hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${pending ? "opacity-50" : ""}`}
    >
      <span className={`font-serif text-base tabular-nums ${current <= 0 ? "text-error" : "text-ink"}`}>{formatPrice(current)}</span>
      <Edit3 className="w-3 h-3 text-stone" aria-hidden="true" />
    </button>
  );
}
