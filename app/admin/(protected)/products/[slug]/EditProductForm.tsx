"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Check } from "lucide-react";
import SpecsEditor from "@/components/admin/SpecsEditor";
import { updateProductFull, type FullUpdateState } from "../actions";

const initial: FullUpdateState = {};

type Props = {
  product: {
    id: string;
    slug: string;
    name: string;
    description: string;
    price: number;
    category: string;
    featured: boolean;
    specs: Record<string, string>;
    stock: number;
    deliveryTime: string | null;
    colorGroup: string | null;
    colorName: string | null;
    colorHex: string | null;
  };
  categories: string[];
};

export default function EditProductForm({ product, categories }: Props) {
  const [state, action, pending] = useActionState(updateProductFull, initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (state.ok) setSavedAt(Date.now());
  }, [state.ok]);

  return (
    <form action={action} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <input type="hidden" name="id" value={product.id} />

      <div className="lg:col-span-2 space-y-6">
        <Field label="Naam" error={state.fieldErrors?.name}>
          <input
            name="name"
            defaultValue={product.name}
            required
            className="w-full px-3 py-2.5 bg-white border border-line text-ink text-sm focus:outline-none focus:border-bronze"
          />
        </Field>

        <Field label="Beschrijving" error={state.fieldErrors?.description}>
          <textarea
            name="description"
            defaultValue={product.description}
            required
            rows={10}
            className="w-full px-3 py-2.5 bg-white border border-line text-ink text-sm leading-relaxed focus:outline-none focus:border-bronze font-serif"
          />
        </Field>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-2">
            Specificaties
          </label>
          <p className="text-[11px] text-stone mb-3">
            Verschijnt als tabel op de productpagina onder de beschrijving.
          </p>
          <SpecsEditor name="specs" initial={product.specs} />
        </div>
      </div>

      <aside className="space-y-6">
        <div className="bg-white border border-line p-5 space-y-5">
          <Field label="Prijs (€)" error={state.fieldErrors?.price}>
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product.price.toFixed(2)}
              required
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm font-serif tabular-nums focus:outline-none focus:border-bronze"
            />
          </Field>

          <Field label="Categorie" error={state.fieldErrors?.category}>
            <select
              name="category"
              defaultValue={product.category}
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm capitalize focus:outline-none focus:border-bronze"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Voorraad" error={state.fieldErrors?.stock}>
            <input
              name="stock"
              type="number"
              min="0"
              step="1"
              defaultValue={product.stock}
              required
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm tabular-nums focus:outline-none focus:border-bronze"
            />
          </Field>

          <Field label="Levertijd" error={state.fieldErrors?.deliveryTime}>
            <input
              name="deliveryTime"
              defaultValue={product.deliveryTime ?? ""}
              placeholder="Bijv. 1-3 werkdagen"
              maxLength={80}
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-bronze"
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              name="featured"
              type="checkbox"
              defaultChecked={product.featured}
              className="w-4 h-4 accent-bronze"
            />
            <span className="text-sm text-ink">Featured op homepage</span>
          </label>
        </div>

        <div className="bg-white border border-line p-5 space-y-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone">Kleurvariant</p>
          <p className="text-[11px] text-stone/80 leading-relaxed">
            Producten met dezelfde groep tonen op de productpagina een kleurkiezer. Laat leeg als dit product geen variant heeft.
          </p>

          <Field label="Groep (gedeelde sleutel)" error={state.fieldErrors?.colorGroup}>
            <input
              name="colorGroup"
              defaultValue={product.colorGroup ?? ""}
              placeholder="bijv. lucce"
              maxLength={80}
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm font-mono focus:outline-none focus:border-bronze"
            />
          </Field>

          <Field label="Kleurnaam" error={state.fieldErrors?.colorName}>
            <input
              name="colorName"
              defaultValue={product.colorName ?? ""}
              placeholder="bijv. Bruin"
              maxLength={40}
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-bronze"
            />
          </Field>

          <Field label="Hex-code (zwatch)" error={state.fieldErrors?.colorHex}>
            <ColorHexInput defaultValue={product.colorHex ?? ""} />
          </Field>
        </div>

        {state.error && (
          <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-ink text-white px-6 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-bronze transition-colors disabled:opacity-60"
          >
            {pending ? "Opslaan…" : "Wijzigingen opslaan"}
          </button>
          {savedAt && !pending && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-bronze">
              <Check className="w-3.5 h-3.5" />
              Opgeslagen
            </span>
          )}
        </div>

        <Link
          href={`/products/${product.slug}`}
          target="_blank"
          className="block text-center text-[11px] uppercase tracking-[0.25em] text-stone hover:text-bronze pt-2"
        >
          Bekijk live →
        </Link>
      </aside>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-2">
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-700 mt-1.5">{error}</p>}
    </div>
  );
}

function ColorHexInput({ defaultValue }: { defaultValue: string }) {
  const [val, setVal] = useState(defaultValue);
  const isValid = /^#[0-9a-fA-F]{6}$/.test(val);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={isValid ? val : "#8B6F47"}
        onChange={(e) => setVal(e.target.value.toUpperCase())}
        className="w-12 h-11 border border-line cursor-pointer p-0"
        aria-label="Kleur kiezen"
      />
      <input
        type="text"
        name="colorHex"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="#8B6F47"
        maxLength={7}
        className="flex-1 px-3 py-2.5 bg-bone border border-line text-ink text-sm font-mono focus:outline-none focus:border-bronze"
      />
      {val && !isValid && (
        <span className="text-[10px] text-red-700 whitespace-nowrap">Ongeldig</span>
      )}
    </div>
  );
}
