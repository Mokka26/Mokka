"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import ProductCard, { type ProductCardProduct } from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import { useCart } from "@/context/CartContext";
import { parseImages } from "@/lib/imageHelpers";
import { getCategory } from "@/lib/categories";
import { Price, formatPrice } from "@/components/ui/price";
import { StockBadge } from "@/components/ui/StockBadge";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ColorSwatches, type ColorVariant } from "@/components/product/ColorSwatches";
import { PurchaseInfo } from "@/components/product/PurchaseInfo";
import type { CheckoutMethod } from "@/lib/mollie";
import { ProductDescription } from "@/components/product/ProductDescription";
import { orientationOf } from "@/components/product/imageAspect";
import { useFooterInView } from "@/components/product/useFooterInView";
import { trackAddToCart, trackViewItem, variantLabelOf } from "@/lib/analytics";
import {
  DELIVERY_KEY_RE,
  DIMENSION_KEYS,
  dimensionContext,
  findSpec,
  parseSizeVariants,
  parseSpecs,
  type SizeVariant,
} from "@/components/product/specs";

// Lightbox (embla + grote foto's) pas laden als een foto wordt vergroot.
const ProductLightbox = dynamic(() => import("@/components/product/ProductLightbox"), { ssr: false });

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  listPrice?: number | null;
  category: string;
  images: string;
  specs?: string | null;
  sizeVariants?: string | null;
  nachtkastMode?: string | null;
  nachtkastPrice?: number | null;
  nachtkastPrice2?: number | null;
  voetbankMode?: string | null;
  voetbankPrice?: number | null;
  featured: boolean;
  stock?: number;
  deliveryTime?: string | null;
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
}

interface Props {
  product: Product;
  relatedProducts: ProductCardProduct[];
  colorVariants: ColorVariant[];
  /** "Past goed bij" — aanvullende producten uit andere categorieën (optioneel). */
  complementaryProducts?: ProductCardProduct[];
  /** Live Mollie-betaalmethoden voor het koopblok (zelfde chips als de footer). */
  mollieMethods?: CheckoutMethod[];
}

/** Event waarmee de Navbar de winkelwagen-drawer kan openen (cancelable). */
export const OPEN_CART_EVENT = "mokka:open-cart";

/**
 * Leest `?maat=<label>` (feed-links per maatvariant) en selecteert die maat.
 * Apart component in Suspense: useSearchParams mag niet in de statische
 * render van de (ISR-)pagina.
 */
function SizeFromQuery({ variants, onSelect }: { variants: SizeVariant[]; onSelect: (index: number) => void }) {
  const params = useSearchParams();
  const maat = params.get("maat");
  useEffect(() => {
    if (!maat) return;
    const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const idx = variants.findIndex((v) => norm(v.label) === norm(maat));
    if (idx >= 0) onSelect(idx);
  }, [maat, variants, onSelect]);
  return null;
}

const OPTION_BTN = "inline-flex items-center justify-center px-4 py-2.5 min-h-11 text-[15px] border rounded-[8px] transition-colors";
const OPTION_ACTIVE = "bg-ink text-paper border-ink";
const OPTION_IDLE = "bg-transparent text-ink border-line hover:border-ink";

export default function ProductDetailClient({ product, relatedProducts, colorVariants, complementaryProducts = [], mollieMethods = [] }: Props) {
  const router = useRouter();
  const images = parseImages(product.images);
  const orientation = orientationOf(images[0]);
  const categoryInfo = getCategory(product.category);
  const categoryLabel = categoryInfo?.label ?? product.category;
  const categorySubtitle = categoryInfo?.cardSubtitle ?? null;

  // Specs één keer parsen; levertijd niet dubbel tonen (staat in het koopblok).
  const specs = parseSpecs(product.specs);
  const dimensions = findSpec(specs, ...DIMENSION_KEYS);
  const dimensionNote = dimensionContext(product.category, dimensions);
  const specEntries = Object.entries(specs).filter(([k]) => !DELIVERY_KEY_RE.test(k));

  // Maat-varianten (bv. bedden): elke maat een eigen prijs. Eerste maat is
  // standaard geselecteerd, tenzij ?maat= een andere kiest.
  const sizeVariants = parseSizeVariants(product.sizeVariants);
  const [selectedSize, setSelectedSize] = useState(0);
  const activeVariant = sizeVariants[selectedSize] ?? null;
  const activePrice = activeVariant?.price ?? product.price;
  const activeListPrice = activeVariant?.listPrice ?? product.listPrice ?? null;

  // Nachtkast-optie (bedden): "included" = inbegrepen, "optional" = 0/1/2 tegen toeslag.
  const nkPrice1 = product.nachtkastPrice ?? 0;
  const nkPrice2 = product.nachtkastPrice2 ?? nkPrice1 * 2;
  const isNkOptional = product.nachtkastMode === "optional" && nkPrice1 > 0;
  const nkAddon = (n: number) => (n === 1 ? nkPrice1 : n === 2 ? nkPrice2 : 0);
  const [nachtkast, setNachtkast] = useState(0);

  // Voetbank-optie (bedden): 0/1 tegen voetbankPrice.
  const vbPrice = product.voetbankPrice ?? 0;
  const isVbOptional = product.voetbankMode === "optional" && vbPrice > 0;
  const [voetbank, setVoetbank] = useState(0);

  const lineUnitPrice = activePrice + (isNkOptional ? nkAddon(nachtkast) : 0) + (isVbOptional ? voetbank * vbPrice : 0);
  const hasOptions = (isNkOptional && nachtkast > 0) || (isVbOptional && voetbank > 0);

  const stock = product.stock ?? 0;
  const inStock = stock > 0;
  const priceOnRequest = activePrice <= 0;
  const canBuy = inStock && !priceOnRequest;
  const requestUrl = `/contact?product=${encodeURIComponent(product.slug)}`;

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const { addToCart } = useCart();
  // Sticky koopbalk verbergen zodra de footer in beeld komt (bedekt anders de footerlinks).
  const footerInView = useFooterInView();

  useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setAdded(false), 2500);
    return () => window.clearTimeout(t);
  }, [added]);

  // GA4 view_item: één keer per bekeken product (prijs van de standaardmaat).
  useEffect(() => {
    trackViewItem({ id: product.id, slug: product.slug, name: product.name, category: product.category, price: product.price });
  }, [product.id, product.slug, product.name, product.category, product.price]);

  const openCart = () => {
    // Navbar kan dit event afvangen (preventDefault) en de drawer openen;
    // anders gaan we naar de winkelwagen-pagina.
    const ev = new CustomEvent(OPEN_CART_EVENT, { cancelable: true });
    const handled = !window.dispatchEvent(ev);
    if (!handled) router.push("/cart");
  };

  const handleAddToCart = () => {
    if (!canBuy) return;
    const variantLabel = activeVariant?.label ?? null;
    addToCart(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: lineUnitPrice,
        listPrice: hasOptions ? null : activeListPrice,
        images: product.images,
        category: product.category,
        deliveryTime: product.deliveryTime ?? null,
        stock,
      },
      variantLabel,
      nachtkast,
      voetbank,
      quantity,
    );
    trackAddToCart(
      { id: product.id, slug: product.slug, name: product.name, category: product.category, price: lineUnitPrice },
      quantity,
      variantLabelOf({ variantLabel, nachtkast, voetbank }),
    );
    // Korte titel, één regel beschrijving (productnaam + opties + aantal; de
    // ToastProvider kapt lange namen af).
    const extras = [
      product.name,
      variantLabel ? `maat ${variantLabel}` : null,
      nachtkast > 0 ? `${nachtkast} nachtkast${nachtkast > 1 ? "en" : ""}` : null,
      voetbank > 0 ? "voetbank" : null,
      `${quantity}×`,
    ].filter(Boolean);
    toast.success("Toegevoegd aan je winkelwagen", {
      description: extras.join(" · "),
      duration: 5000,
      action: { label: "Bekijk winkelwagen", onClick: openCart },
    });
    setAdded(true);
  };

  const buyButtonLabel = !inStock ? "Uitverkocht" : added ? "Toegevoegd" : "In winkelwagen";

  return (
    <>
      {sizeVariants.length > 0 && (
        <Suspense fallback={null}>
          <SizeFromQuery variants={sizeVariants} onSelect={setSelectedSize} />
        </Suspense>
      )}

      <div className="pt-8 lg:pt-12 pb-28 lg:pb-40">
        {/* Product — magazine-spread: beeld links, sticky info rechts */}
        <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-12 items-start">
          <div className="hidden lg:block absolute left-6 top-6 z-10 pointer-events-none" aria-hidden="true">
            <span className="block origin-top-left rotate-90 translate-x-[2px] eyebrow-lg text-stone whitespace-nowrap">
              <span className="text-accent">— </span>
              {categoryLabel}
            </span>
          </div>

          {/* Galerij */}
          <div className="px-6 sm:px-10 lg:pl-24 lg:pr-0">
            <ProductGallery images={images} productName={product.name} orientation={orientation} onOpen={setLightbox} />
          </div>

          {/* Info — sticky op desktop */}
          <div className="px-6 sm:px-10 lg:px-0 lg:pr-[max(56px,calc((100vw-1600px)/2+56px))] flex flex-col lg:sticky lg:top-32 lg:py-4 mt-8 lg:mt-0">
            <p className="text-[14px] uppercase tracking-[0.14em] text-stone mb-3">{categoryLabel}</p>
            <h1 className="display-md text-ink mb-4">{product.name}</h1>
            {categorySubtitle && <p className="text-base text-graphite mb-5">{categorySubtitle}</p>}

            <div className="mb-5">
              <Price price={activePrice} listPrice={activeListPrice} vat size="lg" className="text-accent" />
            </div>

            {dimensions && (
              <dl className="mb-6 text-[15px] leading-relaxed">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-stone">Afmetingen:</dt>
                  <dd className="text-ink tabular-nums">{dimensions}</dd>
                </div>
                {dimensionNote && <dd className="text-graphite">{dimensionNote}</dd>}
              </dl>
            )}

            {sizeVariants.length > 0 && (
              <div className="mb-6" role="group" aria-labelledby="pdp-size-label">
                <p id="pdp-size-label" className="text-[14px] text-stone mb-3">
                  Kies je maat{activeVariant ? ":" : ""}{" "}
                  {activeVariant && <span className="text-ink font-medium">{activeVariant.label}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sizeVariants.map((v, i) => {
                    const active = i === selectedSize;
                    return (
                      <button
                        key={v.label}
                        type="button"
                        onClick={() => setSelectedSize(i)}
                        aria-pressed={active}
                        className={`${OPTION_BTN} ${active ? OPTION_ACTIVE : OPTION_IDLE}`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isNkOptional && (
              <div className="mb-6" role="group" aria-labelledby="pdp-nk-label">
                <p id="pdp-nk-label" className="text-[14px] text-stone mb-3">Nachtkast erbij?</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2].map((n) => {
                    const active = n === nachtkast;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNachtkast(n)}
                        aria-pressed={active}
                        className={`${OPTION_BTN} ${active ? OPTION_ACTIVE : OPTION_IDLE}`}
                      >
                        {n === 0 ? "Geen" : `${n} nachtkast${n > 1 ? "en" : ""} (+${formatPrice(nkAddon(n))})`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isVbOptional && (
              <div className="mb-6" role="group" aria-labelledby="pdp-vb-label">
                <p id="pdp-vb-label" className="text-[14px] text-stone mb-3">Voetbank erbij?</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1].map((n) => {
                    const active = n === voetbank;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setVoetbank(n)}
                        aria-pressed={active}
                        className={`${OPTION_BTN} ${active ? OPTION_ACTIVE : OPTION_IDLE}`}
                      >
                        {n === 0 ? "Geen" : `Voetbank (+${formatPrice(vbPrice)})`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasOptions && !priceOnRequest && (
              <p className="text-base text-ink mb-6" aria-live="polite">
                Totaal met opties: <span className="font-medium tabular-nums">{formatPrice(lineUnitPrice)}</span>
              </p>
            )}

            <ColorSwatches
              currentSlug={product.slug}
              currentColorName={product.colorName ?? null}
              category={product.category}
              variants={colorVariants}
            />

            <div className="mb-5">
              <StockBadge stock={stock} showLow size="md" />
            </div>

            {/* Aantal + koopknop, of prijsaanvraag */}
            {priceOnRequest ? (
              <div className="mb-2">
                <Link href={requestUrl} className="btn-primary w-full text-center">
                  Vraag prijs en levertijd aan
                </Link>
                <p className="text-[14px] text-stone mt-3">We reageren binnen één werkdag met prijs en levertijd.</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 mb-2">
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  name={product.name}
                  max={Math.min(99, Math.max(1, stock))}
                  disabled={!inStock}
                  size="md"
                />
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  aria-disabled={!inStock || undefined}
                  className={`btn-primary flex-1 min-h-[52px] text-center ${added ? "!bg-success !border-success" : ""} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink`}
                >
                  {buyButtonLabel}
                </button>
              </div>
            )}

            <PurchaseInfo price={lineUnitPrice} stock={stock} deliveryTime={product.deliveryTime ?? null} category={product.category} mollieMethods={mollieMethods} />

            {specEntries.length > 0 && (
              <details className="group border-t border-line">
                <summary className="flex items-center justify-between gap-4 py-5 min-h-11 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden text-base text-ink font-medium">
                  Specificaties
                  <svg
                    className="w-4 h-4 text-stone shrink-0 transition-transform duration-300 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <dl className="pb-5">
                  {specEntries.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-6 py-2.5 border-t border-line/60 first:border-t-0 text-[15px]">
                      <dt className="text-stone shrink-0">{k}</dt>
                      <dd className="text-ink text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </div>
        </div>

        <ProductDescription name={product.name} description={product.description} />

        {complementaryProducts.length > 0 && (
          <section className="mt-24 lg:mt-36" aria-labelledby="pdp-complementary">
            <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
              <div className="mb-10 lg:mb-14">
                <h2 id="pdp-complementary" className="font-serif text-3xl lg:text-4xl text-ink">
                  Past goed bij de {product.name}
                </h2>
              </div>
              <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16 list-none">
                {complementaryProducts.slice(0, 4).map((p) => (
                  <li key={p.id}><ProductCard product={p} /></li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {relatedProducts.length > 0 && (
          <section className="mt-24 lg:mt-36">
            <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
              <div className="mb-10 lg:mb-14">
                <SectionHeader
                  number="02"
                  label="Meer uit deze collectie"
                  title={`Meer ${categoryLabel.toLowerCase()}`}
                  linkHref={`/${product.category}`}
                  linkLabel="Alles bekijken"
                />
              </div>
              <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16 list-none">
                {relatedProducts.map((p) => (
                  <li key={p.id}><ProductCard product={p} /></li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Sticky mobile CTA — schuift boven de cookiebanner (--cookie-banner-h,
            gezet door CookieBanner) en verdwijnt zodra de footer in beeld is. */}
        <div
          aria-hidden={footerInView || undefined}
          inert={footerInView || undefined}
          className={`lg:hidden fixed inset-x-0 bottom-[var(--cookie-banner-h,0px)] bg-white/95 backdrop-blur-md border-t border-line z-40 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-[transform,opacity,bottom] duration-[280ms] ${
            footerInView ? "translate-y-full opacity-0 pointer-events-none" : ""
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="shrink-0 min-w-0">
              <Price price={lineUnitPrice} listPrice={hasOptions ? null : activeListPrice} vat size="sm" inline showSavings={false} />
              {activeVariant && <p className="text-[13px] text-stone leading-none mt-1">Maat {activeVariant.label}</p>}
            </div>
            {priceOnRequest ? (
              <Link href={requestUrl} className="btn-primary flex-1 !px-4 text-center">
                Vraag prijs aan
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!inStock}
                className={`btn-primary flex-1 !px-4 min-h-11 ${added ? "!bg-success !border-success" : ""} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink`}
              >
                {buyButtonLabel}
              </button>
            )}
          </div>
        </div>
        <div className="lg:hidden h-[calc(6rem+env(safe-area-inset-bottom))]" aria-hidden="true" />
      </div>

      {lightbox !== null && (
        <ProductLightbox
          images={images}
          productName={product.name}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
