"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { Star, X, Edit3 } from "lucide-react";
import { updateProductInline } from "./actions";

type Row = {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  featured: boolean;
  images: string;
  updatedAt: Date;
};

function firstImage(images: string): string | null {
  try {
    const arr = JSON.parse(images);
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch {
    return null;
  }
}

export default function ProductsTable({ products }: { products: Row[] }) {
  if (products.length === 0) {
    return (
      <div className="bg-white border border-line py-20 text-center">
        <p className="text-stone text-sm">Geen producten gevonden.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line overflow-hidden">
      <table className="w-full">
        <thead className="bg-bone border-b border-line">
          <tr className="text-left">
            <Th className="w-[60px]" />
            <Th>Naam</Th>
            <Th className="hidden md:table-cell">Categorie</Th>
            <Th className="text-right">Prijs</Th>
            <Th className="text-center w-[80px]">Featured</Th>
            <Th className="w-[60px]" />
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-stone font-normal ${className}`}>
      {children}
    </th>
  );
}

function ProductRow({ product }: { product: Row }) {
  const img = firstImage(product.images);
  const [featured, setFeatured] = useState(product.featured);
  const [pending, startTransition] = useTransition();

  const toggleFeatured = () => {
    const next = !featured;
    setFeatured(next);
    startTransition(async () => {
      const res = await updateProductInline({ id: product.id, featured: next });
      if (!res.ok) setFeatured(!next);
    });
  };

  return (
    <tr className="border-b border-line last:border-b-0 hover:bg-bone/40 transition-colors">
      <td className="px-4 py-3">
        {img ? (
          <div className="w-12 h-12 relative bg-bone overflow-hidden">
            <Image src={img} alt={product.name} fill className="object-cover" sizes="48px" />
          </div>
        ) : (
          <div className="w-12 h-12 bg-bone" />
        )}
      </td>
      <td className="px-4 py-3">
        <Link href={`/admin/products/${product.slug}`} className="text-sm text-ink hover:text-bronze">
          {product.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-stone capitalize hidden md:table-cell">
        {product.category}
      </td>
      <td className="px-4 py-3 text-right">
        <PriceCell id={product.id} initial={product.price} />
      </td>
      <td className="px-4 py-3 text-center">
        <button
          type="button"
          onClick={toggleFeatured}
          disabled={pending}
          aria-label={featured ? "Niet meer featured" : "Featured maken"}
          className="inline-flex items-center justify-center w-8 h-8 hover:bg-bone transition-colors disabled:opacity-50"
        >
          <Star
            className={`w-4 h-4 ${
              featured ? "fill-bronze text-bronze" : "text-stone"
            }`}
          />
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/products/${product.slug}`}
          className="inline-flex items-center justify-center w-8 h-8 text-stone hover:text-ink hover:bg-bone transition-colors"
          aria-label="Bewerk product"
        >
          <Edit3 className="w-4 h-4" />
        </Link>
      </td>
    </tr>
  );
}

function PriceCell({ id, initial }: { id: string; initial: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial.toFixed(2));
  const [current, setCurrent] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const n = parseFloat(value.replace(",", "."));
    if (isNaN(n) || n < 0) {
      setError("Ongeldige prijs");
      setValue(current.toFixed(2));
      setEditing(false);
      return;
    }
    if (Math.abs(n - current) < 0.001) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateProductInline({ id, price: n });
      if (res.ok) {
        setCurrent(n);
        setValue(n.toFixed(2));
      } else {
        setError(res.error);
        setValue(current.toFixed(2));
      }
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <span className="text-sm text-stone">€</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(current.toFixed(2));
              setEditing(false);
            }
          }}
          className="w-24 px-2 py-1 text-sm font-serif border border-bronze focus:outline-none text-right tabular-nums"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      title={error ?? "Klik om te bewerken"}
      className={`inline-flex items-center gap-1.5 group ${pending ? "opacity-50" : ""}`}
    >
      <span className="font-serif text-sm text-ink tabular-nums">€{current.toFixed(2)}</span>
      <Edit3 className="w-3 h-3 text-stone opacity-0 group-hover:opacity-100 transition-opacity" />
      {error && <X className="w-3 h-3 text-red-700" />}
    </button>
  );
}
