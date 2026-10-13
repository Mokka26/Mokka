"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import SpecsEditor from "@/components/admin/SpecsEditor";
import SizePriceEditor, { type SizeVariant } from "@/components/admin/SizePriceEditor";
import { subscribeProductUpdated } from "@/components/admin/productUpdated";
import { productUrl } from "@/lib/categories";
import { parsePrice } from "@/lib/parse-price";
import { slugify } from "@/lib/specs";
import { updateProductFull, type FullUpdateState } from "../actions";

const initial: FullUpdateState = {};

type Props = {
  product: {
    id: string;
    updatedAt: string;
    slug: string;
    name: string;
    description: string;
    price: number;
    listPrice: number | null;
    nachtkastMode: string | null;
    nachtkastPrice: number | null;
    nachtkastPrice2: number | null;
    voetbankMode: string | null;
    voetbankPrice: number | null;
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
  validCategories: readonly string[];
  sources: string[];
  imageCount: number;
  justSaved?: boolean;
};

// Volgorde waarin naar het eerste foutveld gesprongen wordt (= volgorde op scherm).
const FIELD_ORDER = [
  "name",
  "slug",
  "description",
  "specs",
  "sizeVariants",
  "price",
  "listPrice",
  "nachtkastMode",
  "nachtkastPrice",
  "nachtkastPrice2",
  "voetbankMode",
  "voetbankPrice",
  "category",
  "stock",
  "deliveryTime",
  "source",
  "featured",
  "hidden",
  "colorGroup",
  "colorName",
  "colorHex",
] as const;

function money(n: number | null): string {
  return n == null ? "" : n.toFixed(2).replace(".", ",");
}

/** Jongste ISO-tijdstempel uit een lijst (ongeldige/lege waarden tellen niet mee). */
function newestIso(...values: Array<string | undefined>): string {
  let best = "";
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (!v) continue;
    const ms = Date.parse(v);
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms;
      best = v;
    }
  }
  return best;
}

const inputCls =
  "w-full min-h-11 px-3 py-2.5 border border-line-strong text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-error";

export default function EditProductForm({ product, categories, validCategories, sources, imageCount, justSaved = false }: Props) {
  const [state, action, pending] = useActionState(updateProductFull, initial);
  const router = useRouter();
  const base = useId();
  const fid = (name: string) => `${base}-${name}`;

  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [priceRaw, setPriceRaw] = useState(money(product.price));
  const [hidden, setHidden] = useState(product.hidden);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(justSaved);
  const lastSavedAt = useRef<number | undefined>(undefined);
  // updatedAt zoals een foto-actie (ImageManager, buur op deze pagina) hem
  // zojuist op de server heeft gezet. Zonder dit weigerde de optimistic lock
  // de volgende opslag ("formulier is verouderd") na elke foto-wijziging.
  const [imagesUpdatedAt, setImagesUpdatedAt] = useState<string | undefined>(undefined);

  useEffect(() => {
    return subscribeProductUpdated((detail) => {
      if (detail.id !== product.id) return;
      if (detail.updatedAt) {
        setImagesUpdatedAt(detail.updatedAt);
        return;
      }
      // Backend stuurt (nog) geen updatedAt mee: de pagina verversen haalt de
      // nieuwe waarde op, maar remount het formulier (key=updatedAt) — dus
      // alleen als er niets onopgeslagen is. Anders blijft de lock verouderd
      // en meldt de server dat bij het opslaan.
      if (!dirty) router.refresh();
    });
  }, [product.id, router, dirty]);

  // Na een geslaagde opslag: "Opgeslagen" tonen en dirty-state resetten.
  useEffect(() => {
    if (!state.savedAt || state.savedAt === lastSavedAt.current) return;
    lastSavedAt.current = state.savedAt;
    setSaved(true);
    setDirty(false);
  }, [state.savedAt]);

  // Waarschuwen bij wegklikken met onopgeslagen wijzigingen.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Eerste foutveld in beeld brengen en focussen.
  useEffect(() => {
    const errors = state.fieldErrors;
    if (!errors) return;
    const first = FIELD_ORDER.find((k) => errors[k]);
    const el = first ? document.getElementById(fid(first)) : null;
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fieldErrors]);

  const onFormChange = () => {
    setDirty(true);
    setSaved(false);
  };

  const parsedPrice = parsePrice(priceRaw);
  const priceMissing = parsedPrice.error != null || parsedPrice.value == null || parsedPrice.value <= 0;
  const publishWarnings: string[] = [];
  if (!hidden && priceMissing) publishWarnings.push("er is nog geen verkoopprijs (groter dan 0)");
  if (!hidden && imageCount === 0) publishWarnings.push("er is nog geen foto");
  const slugChanged = slug !== product.slug;
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} onChange={onFormChange} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="updatedAt" value={newestIso(product.updatedAt, state.updatedAt, imagesUpdatedAt)} />

      <div className="lg:col-span-2 space-y-6">
        <Field id={fid("name")} label="Naam" error={err.name}>
          <input
            id={fid("name")}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
              Adres van de productpagina:{" "}
              <span className="font-mono text-ink">{productUrl({ category: product.category, slug: slug || "…" })}</span>
              {slugChanged && (
                <span className="block mt-1 text-accent-dark">
                  Je wijzigt de URL. De oude link blijft werken: bezoekers en Google worden automatisch
                  doorgestuurd (301) naar de nieuwe pagina.
                </span>
              )}
            </>
          }
        >
          <div className="flex items-stretch gap-2">
            <input
              id={fid("slug")}
              name="slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              required
              maxLength={120}
              aria-invalid={!!err.slug}
              className={`${inputCls} flex-1 bg-white font-mono`}
            />
            <button
              type="button"
              onClick={() => {
                setSlug(slugify(name));
                onFormChange();
              }}
              className="shrink-0 min-h-11 px-3 text-sm uppercase tracking-[0.1em] border border-line text-stone hover:text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
            >
              Uit naam
            </button>
          </div>
        </Field>

        <Field id={fid("description")} label="Beschrijving" error={err.description}>
          <textarea
            id={fid("description")}
            name="description"
            defaultValue={product.description}
            required
            rows={10}
            maxLength={5000}
            aria-invalid={!!err.description}
            className={`${inputCls} bg-white leading-relaxed font-serif`}
          />
        </Field>

        <div id={fid("specs")} tabIndex={-1}>
          <p className="block eyebrow-lg mb-2">Specificaties</p>
          <p className="text-sm text-stone mb-3">Verschijnt als tabel op de productpagina onder de beschrijving.</p>
          <SpecsEditor name="specs" initial={product.specs} />
          {err.specs && <p className="text-sm text-error mt-1.5">{err.specs}</p>}
        </div>

        <div id={fid("sizeVariants")} tabIndex={-1}>
          <p className="block eyebrow-lg mb-2">Maten &amp; prijzen</p>
          <p className="text-sm text-stone mb-3">
            Voor bijvoorbeeld bedden: maten met een eigen prijs. De klant kiest de maat op de productpagina.
            Leeg laten = één vaste prijs.
          </p>
          <SizePriceEditor name="sizeVariants" initial={product.sizeVariants} onChange={onFormChange} />
          {err.sizeVariants && <p className="text-sm text-error mt-1.5">{err.sizeVariants}</p>}
        </div>
      </div>

      <aside className="space-y-6">
        <div className="bg-white border border-line p-5 space-y-5">
          <Field
            id={fid("price")}
            label="Verkoopprijs incl. btw"
            error={err.price}
            help="Wat de klant betaalt, in euro's. Komma of punt mag: 599,50."
          >
            <PrefixedInput prefix="€">
              <input
                id={fid("price")}
                name="price"
                type="text"
                inputMode="decimal"
                value={priceRaw}
                onChange={(e) => setPriceRaw(e.target.value)}
                required
                aria-invalid={!!err.price}
                className={`${inputCls} bg-bone font-serif tabular-nums pl-8`}
              />
            </PrefixedInput>
          </Field>

          <Field
            id={fid("listPrice")}
            label="Adviesprijs (optioneel)"
            error={err.listPrice}
            help="Vul een hogere prijs in dan de verkoopprijs om een doorgestreepte korting te tonen. Leeg = geen korting."
          >
            <PrefixedInput prefix="€">
              <input
                id={fid("listPrice")}
                name="listPrice"
                type="text"
                inputMode="decimal"
                defaultValue={money(product.listPrice)}
                placeholder="Hoger dan verkoopprijs = korting"
                aria-invalid={!!err.listPrice}
                className={`${inputCls} bg-white font-serif tabular-nums pl-8`}
              />
            </PrefixedInput>
          </Field>

          <Field
            id={fid("nachtkastMode")}
            label="Nachtkast (bedden)"
            error={err.nachtkastMode}
            help={
              <>
                <strong>Inbegrepen</strong> toont &ldquo;inclusief nachtkast&rdquo;, zonder meerprijs.{" "}
                <strong>Apart</strong> geeft de keuze 0/1/2 met onderstaande prijzen.
              </>
            }
          >
            <select
              id={fid("nachtkastMode")}
              name="nachtkastMode"
              defaultValue={product.nachtkastMode ?? "none"}
              className={`${inputCls} bg-white`}
            >
              <option value="none">Geen nachtkast</option>
              <option value="included">Inbegrepen (hoort erbij)</option>
              <option value="optional">Apart bij te bestellen</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field id={fid("nachtkastPrice")} label="Prijs 1 nachtkast" error={err.nachtkastPrice}>
              <PrefixedInput prefix="€">
                <input
                  id={fid("nachtkastPrice")}
                  name="nachtkastPrice"
                  type="text"
                  inputMode="decimal"
                  defaultValue={money(product.nachtkastPrice)}
                  placeholder="220,00"
                  aria-invalid={!!err.nachtkastPrice}
                  className={`${inputCls} bg-white font-serif tabular-nums pl-8`}
                />
              </PrefixedInput>
            </Field>
            <Field id={fid("nachtkastPrice2")} label="Prijs 2 nachtkasten" error={err.nachtkastPrice2}>
              <PrefixedInput prefix="€">
                <input
                  id={fid("nachtkastPrice2")}
                  name="nachtkastPrice2"
                  type="text"
                  inputMode="decimal"
                  defaultValue={money(product.nachtkastPrice2)}
                  placeholder="400,00"
                  aria-invalid={!!err.nachtkastPrice2}
                  className={`${inputCls} bg-white font-serif tabular-nums pl-8`}
                />
              </PrefixedInput>
            </Field>
          </div>
          <p className="text-sm text-stone -mt-2">
            Alleen gebruikt bij &ldquo;Apart bij te bestellen&rdquo;. Leeg bij 2 = automatisch 2× de prijs van 1.
          </p>

          <Field
            id={fid("voetbankMode")}
            label="Voetbank (bedden)"
            error={err.voetbankMode}
            help={
              <>
                <strong>Inbegrepen</strong> toont &ldquo;inclusief voetbank&rdquo;. <strong>Apart</strong> geeft de
                keuze wel/geen voetbank tegen onderstaande prijs.
              </>
            }
          >
            <select
              id={fid("voetbankMode")}
              name="voetbankMode"
              defaultValue={product.voetbankMode ?? "none"}
              className={`${inputCls} bg-white`}
            >
              <option value="none">Geen voetbank</option>
              <option value="included">Inbegrepen (hoort erbij)</option>
              <option value="optional">Apart bij te bestellen</option>
            </select>
          </Field>

          <Field id={fid("voetbankPrice")} label="Prijs voetbank" error={err.voetbankPrice}>
            <PrefixedInput prefix="€">
              <input
                id={fid("voetbankPrice")}
                name="voetbankPrice"
                type="text"
                inputMode="decimal"
                defaultValue={money(product.voetbankPrice)}
                placeholder="350,00"
                aria-invalid={!!err.voetbankPrice}
                className={`${inputCls} bg-white font-serif tabular-nums pl-8`}
              />
            </PrefixedInput>
          </Field>

          <Field id={fid("category")} label="Categorie" error={err.category}>
            <select
              id={fid("category")}
              name="category"
              defaultValue={product.category}
              aria-invalid={!!err.category}
              className={`${inputCls} bg-bone capitalize`}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {validCategories.includes(c) ? "" : " (ongeldig — kies een andere)"}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id={fid("stock")}
            label="Voorraad (aantal)"
            error={err.stock}
            help="Aantal stuks dat direct leverbaar is. 0 = uitverkocht; klanten kunnen dan niet bestellen."
          >
            <input
              id={fid("stock")}
              name="stock"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={product.stock}
              required
              aria-invalid={!!err.stock}
              className={`${inputCls} bg-bone tabular-nums`}
            />
          </Field>

          <Field id={fid("deliveryTime")} label="Levertijd" error={err.deliveryTime}>
            <input
              id={fid("deliveryTime")}
              name="deliveryTime"
              defaultValue={product.deliveryTime ?? ""}
              placeholder="Bijv. 1-3 werkdagen"
              maxLength={80}
              aria-invalid={!!err.deliveryTime}
              className={`${inputCls} bg-bone`}
            />
          </Field>

          <Field id={fid("source")} label="Bron / leverancier" error={err.source}>
            <input
              id={fid("source")}
              name="source"
              defaultValue={product.source ?? ""}
              list={fid("source-suggestions")}
              placeholder="bijv. Rousseau"
              maxLength={60}
              aria-invalid={!!err.source}
              className={`${inputCls} bg-bone`}
            />
            <datalist id={fid("source-suggestions")}>
              {sources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>

          <div className="flex items-center gap-3">
            <input
              id={fid("featured")}
              name="featured"
              type="checkbox"
              defaultChecked={product.featured}
              className="w-5 h-5 accent-accent"
            />
            <label htmlFor={fid("featured")} className="text-base text-ink cursor-pointer select-none">
              Uitgelicht op de homepage
            </label>
          </div>

          <div className="pt-4 border-t border-line">
            <div className="flex items-start gap-3">
              <input
                id={fid("hidden")}
                name="hidden"
                type="checkbox"
                checked={hidden}
                onChange={(e) => setHidden(e.target.checked)}
                aria-invalid={!!err.hidden}
                aria-describedby={fid("hidden-help")}
                className="w-5 h-5 mt-0.5 accent-accent"
              />
              <label htmlFor={fid("hidden")} className="text-base text-ink cursor-pointer select-none">
                Verborgen op de site
                <span id={fid("hidden-help")} className="block text-sm text-stone mt-0.5">
                  Vink uit om te publiceren. Verborgen producten zijn niet zichtbaar voor klanten.
                </span>
              </label>
            </div>
            {err.hidden && <p className="text-sm text-error mt-2">{err.hidden}</p>}
            {publishWarnings.length > 0 && (
              <p role="status" className="mt-3 flex items-start gap-2 text-sm text-accent-dark bg-accent/10 border border-accent/30 px-3 py-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Let op: {publishWarnings.join(" en ")}. Opslaan als zichtbaar wordt geweigerd tot dat in orde is.
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-line p-5 space-y-5">
          <p className="eyebrow-lg">Kleurvariant</p>
          <p className="text-sm text-stone leading-relaxed">
            Producten met dezelfde groep tonen op de productpagina een kleurkiezer en delen de verkoop- en
            adviesprijs. Maten, voorraad en foto&rsquo;s blijven per kleur. Laat leeg als dit product geen
            variant heeft.
          </p>

          <Field id={fid("colorGroup")} label="Groep (gedeelde sleutel)" error={err.colorGroup}>
            <input
              id={fid("colorGroup")}
              name="colorGroup"
              defaultValue={product.colorGroup ?? ""}
              placeholder="bijv. lucce"
              maxLength={80}
              aria-invalid={!!err.colorGroup}
              className={`${inputCls} bg-bone font-mono`}
            />
          </Field>

          <Field id={fid("colorName")} label="Kleurnaam" error={err.colorName}>
            <input
              id={fid("colorName")}
              name="colorName"
              defaultValue={product.colorName ?? ""}
              placeholder="bijv. Bruin"
              maxLength={40}
              aria-invalid={!!err.colorName}
              className={`${inputCls} bg-bone`}
            />
          </Field>

          <Field id={fid("colorHex")} label="Kleurcode (staal)" error={err.colorHex}>
            <ColorHexInput id={fid("colorHex")} defaultValue={product.colorHex ?? ""} invalid={!!err.colorHex} />
          </Field>
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-error bg-error/10 border border-error/30 px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="w-full sm:w-auto min-h-12 bg-ink text-white px-6 py-3 text-sm uppercase tracking-[0.1em] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors disabled:opacity-60"
          >
            {pending ? "Opslaan…" : "Wijzigingen opslaan"}
          </button>
          {saved && !pending && !dirty && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
              <Check className="w-4 h-4" aria-hidden="true" />
              Opgeslagen
            </span>
          )}
          {dirty && !pending && <span className="text-sm text-stone">Niet-opgeslagen wijzigingen</span>}
        </div>

        {product.hidden ? (
          <Link
            href={`/admin/preview/${product.slug}`}
            target="_blank"
            className="block text-center min-h-11 eyebrow-lg hover:text-accent pt-2"
          >
            Voorbeeld bekijken (verborgen) →
          </Link>
        ) : (
          <Link
            href={productUrl(product)}
            target="_blank"
            className="block text-center min-h-11 eyebrow-lg hover:text-accent pt-2"
          >
            Bekijk live →
          </Link>
        )}
      </aside>
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
      <label htmlFor={id} className="block eyebrow-lg mb-2">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-error mt-1.5">
          {error}
        </p>
      )}
      {help && <p className="text-sm text-stone mt-1.5">{help}</p>}
    </div>
  );
}

function PrefixedInput({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-stone pointer-events-none">
        {prefix}
      </span>
      {children}
    </div>
  );
}

function ColorHexInput({ id, defaultValue, invalid }: { id: string; defaultValue: string; invalid: boolean }) {
  const [val, setVal] = useState(defaultValue);
  const isValid = /^#[0-9a-fA-F]{6}$/.test(val);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={isValid ? val : "#8B6F47"}
        onChange={(e) => setVal(e.target.value.toUpperCase())}
        className="w-12 h-11 border border-line cursor-pointer p-0 shrink-0"
        aria-label="Kleur kiezen"
      />
      <input
        id={id}
        type="text"
        name="colorHex"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="#8B6F47"
        maxLength={7}
        aria-invalid={invalid || (val !== "" && !isValid)}
        className={`${inputCls} flex-1 bg-bone font-mono`}
      />
      {val && !isValid && <span className="text-sm text-error whitespace-nowrap">Ongeldig</span>}
    </div>
  );
}
