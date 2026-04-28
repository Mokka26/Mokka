"use client";

import { useActionState, useState } from "react";
import ImageManager from "@/components/admin/ImageManager";
import type { ProductImage } from "@/lib/imageHelpers";
import { createProduct, type CreateProductState } from "../actions";

const initial: CreateProductState = {};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function NewProductForm({ categories }: { categories: string[] }) {
  const [state, action, pending] = useActionState(createProduct, initial);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState(categories[0] ?? "banken");
  const [images, setImages] = useState<ProductImage[]>([]);

  const effectiveSlug = slug || slugify(name);

  return (
    <form action={action} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div className="lg:col-span-2 space-y-6">
        <Field label="Naam" error={state.fieldErrors?.name}>
          <input
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug("");
            }}
            required
            className="w-full px-3 py-2.5 bg-white border border-line text-ink text-sm focus:outline-none focus:border-bronze"
          />
        </Field>

        <Field label="Slug (URL)" error={state.fieldErrors?.slug}>
          <input
            name="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugTouched(true);
            }}
            required
            className="w-full px-3 py-2.5 bg-white border border-line text-ink text-sm font-mono focus:outline-none focus:border-bronze"
          />
          <p className="text-[11px] text-stone mt-1.5">
            Wordt: <span className="font-mono">/products/{effectiveSlug || "…"}</span>
          </p>
        </Field>

        <Field label="Beschrijving" error={state.fieldErrors?.description}>
          <textarea
            name="description"
            required
            rows={10}
            className="w-full px-3 py-2.5 bg-white border border-line text-ink text-sm leading-relaxed focus:outline-none focus:border-bronze font-serif"
          />
        </Field>
      </div>

      <aside className="space-y-6">
        <div className="bg-white border border-line p-5 space-y-5">
          <Field label="Prijs (€)" error={state.fieldErrors?.price}>
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm font-serif tabular-nums focus:outline-none focus:border-bronze"
            />
          </Field>

          <Field label="Categorie" error={state.fieldErrors?.category}>
            <select
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
              defaultValue={10}
              required
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm tabular-nums focus:outline-none focus:border-bronze"
            />
          </Field>

          <Field label="Levertijd" error={state.fieldErrors?.deliveryTime}>
            <input
              name="deliveryTime"
              placeholder="Bijv. 1-3 werkdagen"
              maxLength={80}
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-bronze"
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              name="featured"
              type="checkbox"
              className="w-4 h-4 accent-bronze"
            />
            <span className="text-sm text-ink">Featured op homepage</span>
          </label>
        </div>

        {state.error && (
          <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-ink text-white px-6 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-bronze transition-colors disabled:opacity-60"
        >
          {pending ? "Aanmaken…" : "Product aanmaken"}
        </button>
      </aside>

      <section className="lg:col-span-3 mt-6 pt-8 border-t border-line">
        <header className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-1.5">
            Afbeeldingen (optioneel)
          </p>
          <h2 className="font-serif text-xl text-ink leading-none">
            Voeg foto&rsquo;s toe
          </h2>
          <p className="text-[12px] text-stone mt-2">
            Vul eerst de naam en categorie in zodat foto&rsquo;s in de juiste map worden opgeslagen.
            Foto&rsquo;s worden meegestuurd bij &lsquo;Product aanmaken&rsquo;.
          </p>
        </header>

        <ImageManager
          category={category}
          slug={effectiveSlug || "ongesorteerd"}
          initialImages={images}
          onChange={setImages}
          persist={false}
        />
      </section>
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
