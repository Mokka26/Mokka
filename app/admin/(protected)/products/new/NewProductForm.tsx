"use client";

import { useActionState, useId, useState } from "react";
import ImageManager from "@/components/admin/ImageManager";
import type { AdminImage } from "../../_lib/images";
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

const inputCls =
  "w-full min-h-11 px-3 py-2.5 border border-line text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-error";

export default function NewProductForm({ categories }: { categories: string[] }) {
  const [state, action, pending] = useActionState(createProduct, initial);
  const base = useId();
  const fid = (name: string) => `${base}-${name}`;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [images, setImages] = useState<AdminImage[]>([]);

  const effectiveSlug = slug || slugify(name);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div className="lg:col-span-2 space-y-6">
        <Field id={fid("name")} label="Naam" error={err.name}>
          <input
            id={fid("name")}
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug("");
            }}
            required
            maxLength={200}
            aria-invalid={!!err.name}
            className={`${inputCls} bg-white`}
          />
        </Field>

        <Field
          id={fid("slug")}
          label="URL (slug)"
          error={err.slug}
          help={
            <>
              Wordt: <span className="font-mono text-ink">/{category || "…"}/{effectiveSlug || "…"}</span>
            </>
          }
        >
          <input
            id={fid("slug")}
            name="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugTouched(true);
            }}
            required
            maxLength={120}
            aria-invalid={!!err.slug}
            className={`${inputCls} bg-white font-mono`}
          />
        </Field>

        <Field id={fid("description")} label="Beschrijving" error={err.description}>
          <textarea
            id={fid("description")}
            name="description"
            required
            rows={10}
            maxLength={5000}
            aria-invalid={!!err.description}
            className={`${inputCls} bg-white leading-relaxed font-serif`}
          />
        </Field>
      </div>

      <aside className="space-y-6">
        <div className="bg-white border border-line p-5 space-y-5">
          <Field id={fid("price")} label="Verkoopprijs incl. btw" error={err.price} help="In euro's; komma of punt mag: 599,50.">
            <input
              id={fid("price")}
              name="price"
              type="text"
              inputMode="decimal"
              required
              aria-invalid={!!err.price}
              className={`${inputCls} bg-bone font-serif tabular-nums`}
            />
          </Field>

          <Field id={fid("listPrice")} label="Adviesprijs (optioneel)" error={err.listPrice} help="Hoger dan de verkoopprijs = doorgestreepte korting.">
            <input
              id={fid("listPrice")}
              name="listPrice"
              type="text"
              inputMode="decimal"
              aria-invalid={!!err.listPrice}
              className={`${inputCls} bg-white font-serif tabular-nums`}
            />
          </Field>

          <Field id={fid("category")} label="Categorie" error={err.category}>
            <select
              id={fid("category")}
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-invalid={!!err.category}
              className={`${inputCls} bg-bone capitalize`}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field id={fid("stock")} label="Voorraad (aantal)" error={err.stock} help="Aantal stuks dat direct leverbaar is.">
            <input
              id={fid("stock")}
              name="stock"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={10}
              required
              aria-invalid={!!err.stock}
              className={`${inputCls} bg-bone tabular-nums`}
            />
          </Field>

          <Field id={fid("deliveryTime")} label="Levertijd" error={err.deliveryTime}>
            <input
              id={fid("deliveryTime")}
              name="deliveryTime"
              placeholder="Bijv. 1-3 werkdagen"
              maxLength={80}
              className={`${inputCls} bg-bone`}
            />
          </Field>

          <div className="flex items-center gap-3">
            <input id={fid("featured")} name="featured" type="checkbox" className="w-5 h-5 accent-accent" />
            <label htmlFor={fid("featured")} className="text-base text-ink cursor-pointer select-none">
              Uitgelicht op de homepage
            </label>
          </div>

          <div className="pt-4 border-t border-line">
            <div className="flex items-start gap-3">
              <input id={fid("hidden")} name="hidden" type="checkbox" defaultChecked className="w-5 h-5 mt-0.5 accent-accent" />
              <label htmlFor={fid("hidden")} className="text-base text-ink cursor-pointer select-none">
                Verborgen aanmaken (aanbevolen)
                <span className="block text-sm text-stone mt-0.5">
                  Controleer eerst prijs, foto&rsquo;s en tekst; publiceer daarna via het bewerkscherm.
                </span>
              </label>
            </div>
            {err.hidden && <p className="text-sm text-error mt-2">{err.hidden}</p>}
          </div>
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-error bg-error/10 border border-error/30 px-3 py-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full min-h-11 bg-ink text-white px-6 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors disabled:opacity-60"
        >
          {pending ? "Aanmaken…" : "Product aanmaken"}
        </button>
      </aside>

      <section className="lg:col-span-3 mt-6 pt-8 border-t border-line">
        <header className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-1.5">Afbeeldingen (optioneel)</p>
          <h2 className="font-serif text-xl text-ink leading-none">Voeg foto&rsquo;s toe</h2>
          <p className="text-base text-stone mt-2">
            Vul eerst de naam en categorie in zodat foto&rsquo;s in de juiste map worden opgeslagen. Foto&rsquo;s
            worden meegestuurd bij &lsquo;Product aanmaken&rsquo;.
          </p>
        </header>

        <ImageManager
          category={category || "ongesorteerd"}
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
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-2">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-error mt-1.5">{error}</p>}
      {help && <p className="text-sm text-stone mt-1.5">{help}</p>}
    </div>
  );
}
