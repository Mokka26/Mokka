"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Check } from "lucide-react";
import SpecsEditor from "@/components/admin/SpecsEditor";
import SizePriceEditor, { type SizeVariant } from "@/components/admin/SizePriceEditor";
import { updateProductFull, type FullUpdateState } from "../actions";
import { dbCategoryToRouteSlug } from "@/lib/categories";

const initial: FullUpdateState = {};

type Props = {
  product: {
    id: string;
    slug: string;
    name: string;
    description: string;
    price: number;
    listPrice: number | null;
    nachtkastMode: string | null;
    nachtkastPrice: number | null;
    nachtkastPrice2: number | null;
    category: string;
    featured: boolean;
    hidden: boolean;
    specs: Record<string, string>;
    sizeVariants: SizeVariant[];
    stock: number;
    deliveryTime: string | null;
    colorGroup: string | null;
    colorName: string | null;
    colorHex: string | null;
    source: string | null;
  };
  categories: string[];
  sources: string[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function EditProductForm({ product, categories, sources }: Props) {
  const [state, action, pending] = useActionState(updateProductFull, initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);

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
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2.5 bg-white border border-line text-ink text-sm focus:outline-none focus:border-accent"
          />
        </Field>

        <Field label="URL (slug)" error={state.fieldErrors?.slug}>
          <div className="flex items-center gap-2">
            <input
              name="slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              required
              className="flex-1 px-3 py-2.5 bg-white border border-line text-ink text-sm font-mono focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setSlug(slugify(name))}
              className="shrink-0 px-3 py-2.5 text-[11px] uppercase tracking-[0.15em] border border-line text-stone hover:text-ink hover:border-accent transition-colors"
            >
              Uit naam
            </button>
          </div>
          <p className="text-[11px] text-stone mt-1.5">
            Adres van de productpagina: <span className="font-mono text-ink">/{product.category}/{slug || "…"}</span>
            {slug !== product.slug && (
              <span className="text-amber-700"> — let op: oude link gaat niet meer werken</span>
            )}
          </p>
        </Field>

        <Field label="Beschrijving" error={state.fieldErrors?.description}>
          <textarea
            name="description"
            defaultValue={product.description}
            required
            rows={10}
            className="w-full px-3 py-2.5 bg-white border border-line text-ink text-sm leading-relaxed focus:outline-none focus:border-accent font-serif"
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

        <div>
          <label className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-2">
            Maten &amp; prijzen
          </label>
          <p className="text-[11px] text-stone mb-3">
            Voor bv. bedden: maten met een eigen prijs. De klant kiest de maat op
            de productpagina. Leeg laten = één vaste prijs.
          </p>
          <SizePriceEditor name="sizeVariants" initial={product.sizeVariants} />
        </div>
      </div>

      <aside className="space-y-6">
        <div className="bg-white border border-line p-5 space-y-5">
          <Field label="Verkoopprijs (€)" error={state.fieldErrors?.price}>
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product.price.toFixed(2)}
              required
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm font-serif tabular-nums focus:outline-none focus:border-accent"
            />
          </Field>

          <Field label="Adviesprijs (€) — optioneel" error={state.fieldErrors?.listPrice}>
            <input
              name="listPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product.listPrice != null ? product.listPrice.toFixed(2) : ""}
              placeholder="Hoger dan verkoopprijs = korting"
              className="w-full px-3 py-2.5 bg-white border border-line text-stone text-sm font-serif tabular-nums focus:outline-none focus:border-accent"
            />
            <p className="text-[11px] text-stone mt-1.5">
              Vul een hogere prijs in dan de verkoopprijs om een doorgestreepte
              korting te tonen. Leeg = geen korting.
            </p>
          </Field>

          <Field label="Nachtkast (bedden)" error={state.fieldErrors?.nachtkastMode}>
            <select
              name="nachtkastMode"
              defaultValue={product.nachtkastMode ?? "none"}
              className="w-full px-3 py-2.5 bg-white border border-line text-stone text-sm focus:outline-none focus:border-accent"
            >
              <option value="none">Geen nachtkast</option>
              <option value="included">Inbegrepen (hoort erbij)</option>
              <option value="optional">Apart bij te bestellen</option>
            </select>
            <p className="text-[11px] text-stone mt-1.5">
              <strong>Inbegrepen</strong> → toont &quot;inclusief nachtkast&quot;, geen
              meerprijs. <strong>Apart</strong> → keuze 0/1/2 met onderstaande prijzen.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Prijs 1 nachtkast (€)" error={state.fieldErrors?.nachtkastPrice}>
              <input
                name="nachtkastPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product.nachtkastPrice != null ? product.nachtkastPrice.toFixed(2) : ""}
                placeholder="Bijv. 220,00"
                className="w-full px-3 py-2.5 bg-white border border-line text-stone text-sm font-serif tabular-nums focus:outline-none focus:border-accent"
              />
            </Field>
            <Field label="Prijs 2 nachtkasten (€)" error={state.fieldErrors?.nachtkastPrice2}>
              <input
                name="nachtkastPrice2"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product.nachtkastPrice2 != null ? product.nachtkastPrice2.toFixed(2) : ""}
                placeholder="Bijv. 400,00"
                className="w-full px-3 py-2.5 bg-white border border-line text-stone text-sm font-serif tabular-nums focus:outline-none focus:border-accent"
              />
            </Field>
          </div>
          <p className="text-[11px] text-stone mb-2">
            Alleen gebruikt bij &quot;Apart bij te bestellen&quot;. Leeg bij 2 = automatisch 2× de prijs van 1.
          </p>

          <Field label="Categorie" error={state.fieldErrors?.category}>
            <select
              name="category"
              defaultValue={product.category}
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm capitalize focus:outline-none focus:border-accent"
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
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm tabular-nums focus:outline-none focus:border-accent"
            />
          </Field>

          <Field label="Levertijd" error={state.fieldErrors?.deliveryTime}>
            <input
              name="deliveryTime"
              defaultValue={product.deliveryTime ?? ""}
              placeholder="Bijv. 1-3 werkdagen"
              maxLength={80}
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-accent"
            />
          </Field>

          <Field label="Bron / herkomst" error={state.fieldErrors?.source}>
            <input
              name="source"
              defaultValue={product.source ?? ""}
              list="source-suggestions"
              placeholder="bijv. Rousseau"
              maxLength={60}
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-accent"
            />
            <datalist id="source-suggestions">
              {sources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              name="featured"
              type="checkbox"
              defaultChecked={product.featured}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-sm text-ink">Featured op homepage</span>
          </label>

          <div className="pt-4 border-t border-line">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                name="hidden"
                type="checkbox"
                defaultChecked={product.hidden}
                className="w-4 h-4 mt-0.5 accent-accent"
              />
              <span className="text-sm text-ink">
                Verborgen op site
                <span className="block text-[11px] text-stone mt-0.5">
                  Vink uit om te publiceren. Verborgen producten zijn niet zichtbaar voor klanten.
                </span>
              </span>
            </label>
          </div>
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
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm font-mono focus:outline-none focus:border-accent"
            />
          </Field>

          <Field label="Kleurnaam" error={state.fieldErrors?.colorName}>
            <input
              name="colorName"
              defaultValue={product.colorName ?? ""}
              placeholder="bijv. Bruin"
              maxLength={40}
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-accent"
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
            className="bg-ink text-white px-6 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-accent transition-colors disabled:opacity-60"
          >
            {pending ? "Opslaan…" : "Wijzigingen opslaan"}
          </button>
          {savedAt && !pending && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-accent">
              <Check className="w-3.5 h-3.5" />
              Opgeslagen
            </span>
          )}
        </div>

        <Link
          href={`/${dbCategoryToRouteSlug(product.category)}/${product.slug}`}
          target="_blank"
          className="block text-center text-[11px] uppercase tracking-[0.25em] text-stone hover:text-accent pt-2"
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
        className="flex-1 px-3 py-2.5 bg-bone border border-line text-ink text-sm font-mono focus:outline-none focus:border-accent"
      />
      {val && !isValid && (
        <span className="text-[10px] text-red-700 whitespace-nowrap">Ongeldig</span>
      )}
    </div>
  );
}
