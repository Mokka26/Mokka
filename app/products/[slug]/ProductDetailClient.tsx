"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { cldOptimize } from "@/lib/cloudinary-url";
import { parseImages } from "@/lib/imageHelpers";
import { getUspsByKey, shippingInfo } from "@/lib/shipping-info";
import { getCategory } from "@/lib/categories";
import { formatPrice } from "@/components/ui/price";

interface Product {
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
  featured: boolean;
  stock?: number;
  deliveryTime?: string | null;
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
}

type SizeVariant = { label: string; price?: number; listPrice?: number };

function parseSizeVariants(raw: string | null | undefined): SizeVariant[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((v) => v && typeof v.label === "string")
      .map((v) => ({
        label: String(v.label),
        ...(typeof v.price === "number" ? { price: Number(v.price) } : {}),
        ...(typeof v.listPrice === "number" ? { listPrice: Number(v.listPrice) } : {}),
      }));
  } catch {
    return [];
  }
}

interface ColorVariant {
  id: string;
  slug: string;
  colorName: string | null;
  colorHex: string | null;
}

function parseSpecs(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === "string" && typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

interface Props {
  product: Product;
  relatedProducts: Product[];
  colorVariants: ColorVariant[];
}

// Icons matched op USP-key uit lib/shipping-info
const USP_ICONS: Record<string, string> = {
  shipping: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  warranty: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  return: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
};

const usps = getUspsByKey("shipping", "warranty", "return").map((u) => ({
  icon: USP_ICONS[u.key] ?? "",
  label: u.title,
  sub: u.description,
}));

export default function ProductDetailClient({ product, relatedProducts, colorVariants }: Props) {
  const parsed = parseImages(product.images);
  const images: string[] = parsed.map((i) => i.url);
  // Vierkante weergave (1:1) + c_fill: vrijwel alle productfoto's zijn vierkant,
  // dus ze vullen het frame exact — geen witte zijbalken, volledig product.
  const sourceWAt = (idx: number): number | undefined => parsed[idx]?.w;

  // Maat-varianten (bv. bedden): elke maat een eigen prijs. Eerste maat is
  // standaard geselecteerd. Geen varianten → normale enkele prijs.
  const sizeVariants = parseSizeVariants(product.sizeVariants);
  const [selectedSize, setSelectedSize] = useState(0);
  const activeVariant = sizeVariants[selectedSize] ?? null;
  // Maat-prijs is een optionele override; leeg → product-verkoopprijs/advies.
  const activePrice = activeVariant?.price ?? product.price;
  const activeListPrice = activeVariant?.listPrice ?? product.listPrice ?? null;
  const hasDiscount = activeListPrice != null && activeListPrice > activePrice;

  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  // Portal mount-flag: createPortal vereist een client-side document
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { addToCart } = useCart();

  // Categorie-regel onder de prijs (bv. banken → "In diverse uitvoeringen
  // en kleuren."). Bron: lib/categories.ts.
  const categorySubtitle = getCategory(product.category)?.cardSubtitle ?? null;

  // Mobile swipe carousel
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });
  // Lightbox carousel (loops)
  const [lightboxRef, lightboxApi] = useEmblaCarousel({ loop: true });

  const scrollTo = useCallback(
    (index: number) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi]
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveSlide(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Lightbox: sync swipe → index, jump to start index on open.
  // lightboxIndex is hier alleen seed bij init; embla "select" stuurt het verder.
  useEffect(() => {
    if (!lightboxApi) return;
    lightboxApi.scrollTo(lightboxIndex, true);
    const onSelect = () => setLightboxIndex(lightboxApi.selectedScrollSnap());
    lightboxApi.on("select", onSelect);
    return () => {
      lightboxApi.off("select", onSelect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxApi]);

  // Lightbox: scroll lock + keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") lightboxApi?.scrollPrev();
      if (e.key === "ArrowRight") lightboxApi?.scrollNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [lightboxOpen, lightboxApi]);

  const openLightbox = (i: number) => {
    setLightboxIndex(i);
    setLightboxOpen(true);
  };

  const handleAddToCart = () => {
    // Bij maat-varianten: regel-prijs = maatprijs, en de maat als variant-label.
    const linePrice = activePrice;
    const variantLabel = activeVariant?.label ?? null;
    for (let i = 0; i < quantity; i++) {
      addToCart(
        { id: product.id, slug: product.slug, name: product.name, price: linePrice, images: product.images, category: product.category },
        variantLabel,
      );
    }
    toast.success(`${product.name} toegevoegd aan winkelwagen`, {
      description: variantLabel ? `Maat ${variantLabel} · Aantal: ${quantity}` : `Aantal: ${quantity}`,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleZoomMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  };

  return (
    <>
      <div className="pt-32 lg:pt-40 pb-28 lg:pb-40">
        {/* Breadcrumb */}
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-12 lg:mb-16">
          <nav className="text-[11px] text-stone uppercase tracking-[0.25em] font-medium">
            <Link href="/" className="hover:text-accent transition-colors duration-[280ms]">Home</Link>
            <span className="mx-3 text-mist">/</span>
            <Link href="/products" className="hover:text-accent transition-colors duration-[280ms]">Producten</Link>
            <span className="mx-3 text-mist">/</span>
            <Link href={`/${product.category}`} className="hover:text-accent transition-colors duration-[280ms] capitalize">{product.category}</Link>
            <span className="mx-3 text-mist">/</span>
            <span className="text-ink">{product.name}</span>
          </nav>
        </div>

        {/* Product — magazine-spread: image bleed naar left edge op desktop */}
        <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-12 items-start">
          {/* Vertical chapter label — sticky in left margin op desktop */}
          <div className="hidden lg:block absolute left-6 top-44 z-10 pointer-events-none">
            <span className="block origin-top-left rotate-90 translate-x-[2px] eyebrow text-stone whitespace-nowrap">
              <span className="text-accent">— </span>
              {product.category}
              <span className="text-stone/50"> · 01</span>
            </span>
          </div>

          {/* Afbeeldingen — bleeds links */}
          <div className="px-6 sm:px-10 lg:pl-0 lg:pr-0 relative">
              {/* Mobile — swipe carousel */}
              <div className="lg:hidden">
                <div
                  className="relative overflow-hidden bg-bone cursor-zoom-in rounded-[10px]"
                  ref={emblaRef}
                  onClick={() => openLightbox(activeSlide)}
                >
                  <div className="flex">
                    {images.map((img, i) => (
                      <div
                        key={i}
                        className="flex-[0_0_100%] bg-white"
                      >
                        <Image
                          src={cldOptimize(img, {
                            ar: "1:1",
                            w: 1600,
                            mode: "fill",
                            upscale: true,
                            sourceW: sourceWAt(i),
                            dpr: "auto",
                            quality: "auto:good",
                          })}
                          alt={`${product.name} — ${i + 1}`}
                          width={1600}
                          height={1600}
                          priority={i === 0}
                          unoptimized
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  {images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-ink font-medium rounded-full">
                      {activeSlide + 1} / {images.length}
                    </div>
                  )}
                </div>

                {/* Pagination dots */}
                {images.length > 1 && (
                  <div className="flex justify-center gap-2 mt-5">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => scrollTo(i)}
                        aria-label={`Ga naar foto ${i + 1}`}
                        className={`h-[2px] transition-all duration-300 ${
                          activeSlide === i ? "w-8 bg-ink" : "w-4 bg-mist hover:bg-stone"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop — vertical thumbs + main met hover zoom */}
              <div className="hidden lg:flex gap-5">
                {/* Vertical thumbnails */}
                <div className="flex flex-col gap-3 flex-shrink-0 w-[96px]">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      aria-label={`Toon foto ${i + 1}`}
                      className={`relative w-[80px] h-[80px] flex-shrink-0 overflow-hidden bg-bone rounded-md transition-all duration-200 ${
                        selectedImage === i
                          ? "opacity-100 ring-1 ring-ink/40"
                          : "opacity-50 hover:opacity-100"
                      }`}
                    >
                      <Image src={cldOptimize(img, { ar: "1:1", w: 240, mode: "fill", quality: "auto:good" })} alt="" fill loading="lazy" unoptimized className="object-cover" sizes="80px" />
                    </button>
                  ))}
                </div>

                {/* Hoofd afbeelding met hover zoom */}
                <div
                  className="relative aspect-square flex-1 bg-white overflow-hidden cursor-zoom-in rounded-[10px]"
                  onMouseEnter={() => setZoomActive(true)}
                  onMouseLeave={() => setZoomActive(false)}
                  onMouseMove={handleZoomMove}
                  onClick={() => openLightbox(selectedImage)}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedImage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={cldOptimize(images[selectedImage], {
                          ar: "1:1",
                          w: 1800,
                          mode: "fill",
                          upscale: true,
                          sourceW: sourceWAt(selectedImage),
                          dpr: "auto",
                          quality: "auto:good",
                        })}
                        alt={product.name}
                        fill
                        priority
                        unoptimized
                        className="object-cover transition-transform duration-200 ease-out will-change-transform"
                        style={
                          zoomActive
                            ? { transform: "scale(1.8)", transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
                            : undefined
                        }
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Subtiele expand hint */}
                  <div className="absolute bottom-4 right-4 bg-white/85 backdrop-blur-sm px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-ink font-medium pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    Vergroten
                  </div>
                </div>
              </div>
            </div>

            {/* Info — sticky op desktop, focus op conversie */}
          {/* Info — sticky op desktop, gracious whitespace rechts */}
          <div className="px-6 sm:px-10 lg:px-0 lg:pr-[max(56px,calc((100vw-1600px)/2+56px))] flex flex-col lg:sticky lg:top-32 lg:py-8">
              <p className="eyebrow capitalize mb-4">
                {product.category}
              </p>
              <h1 className="display-md text-ink mb-5">
                {product.name}
              </h1>
              {categorySubtitle && (
                <p className="text-sm text-slate mb-5 -mt-2">{categorySubtitle}</p>
              )}

              <div className="mb-8">
                <div className="flex items-baseline gap-3">
                  {hasDiscount && (
                    <span className="font-serif text-lg lg:text-xl text-stone/70 font-light line-through tabular-nums">
                      {formatPrice(activeListPrice)}
                    </span>
                  )}
                  <p className="font-serif text-2xl lg:text-3xl text-accent font-light tabular-nums tracking-[-0.025em]" style={{ fontVariationSettings: '"opsz" 48' }}>
                    {formatPrice(activePrice)}
                  </p>
                </div>
                <p className="text-[13px] text-slate mt-1">{shippingInfo.vatLabelShort}</p>
              </div>

              {sizeVariants.length > 0 && (
                <div className="mb-8">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-stone mb-3">Kies je maat</p>
                  <div className="flex flex-wrap gap-2">
                    {sizeVariants.map((v, i) => {
                      const active = i === selectedSize;
                      return (
                        <button
                          key={v.label}
                          type="button"
                          onClick={() => setSelectedSize(i)}
                          aria-pressed={active}
                          className={`px-4 py-2.5 text-sm border rounded-[8px] transition-colors min-h-[44px] ${
                            active
                              ? "bg-ink text-white border-ink"
                              : "bg-transparent text-ink border-line hover:border-ink"
                          }`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="w-10 h-[1px] bg-line mb-8" />

              <ColorVariantPicker
                currentSlug={product.slug}
                currentColorName={product.colorName ?? null}
                variants={colorVariants}
              />

              <StockDeliveryInfo
                stock={product.stock ?? 0}
                deliveryTime={product.deliveryTime ?? null}
              />

              {/* Aantal + Knop */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="flex items-center border border-line rounded-[10px] overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={(product.stock ?? 0) === 0}
                    className="px-5 py-4 text-stone hover:text-accent transition-colors duration-[280ms] text-sm disabled:opacity-40"
                  >−</button>
                  <span className="px-4 py-4 text-ink text-sm min-w-[3rem] text-center tabular-nums">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock ?? 99, quantity + 1))}
                    disabled={quantity >= (product.stock ?? 0)}
                    className="px-5 py-4 text-stone hover:text-accent transition-colors duration-[280ms] text-sm disabled:opacity-40"
                  >+</button>
                </div>
                <motion.button
                  onClick={handleAddToCart}
                  disabled={(product.stock ?? 0) === 0}
                  className={`btn-primary flex-1 text-center ${added ? "!bg-success" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
                  whileTap={{ scale: 0.98 }}
                >
                  {(product.stock ?? 0) === 0 ? "Uitverkocht" : added ? "Toegevoegd!" : "In Winkelwagen"}
                </motion.button>
              </div>

              {/* Korte intro paragraaf (eerste deel beschrijving) */}
              <p className="text-sm lg:text-base text-slate leading-relaxed mb-8">
                {product.description.length > 220
                  ? product.description.slice(0, 220).trim() + "…"
                  : product.description}
              </p>

              {/* Specificaties — uitklapbaar in de hero */}
              <HeroSpecs specs={parseSpecs(product.specs)} />

              {/* USP's */}
              <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 pt-8 border-t border-line">
                {usps.map((usp) => (
                  <div key={usp.label} className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={usp.icon} />
                    </svg>
                    <span className="text-stone text-[11px] uppercase tracking-[0.2em] font-medium">{usp.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        {/* Beschrijving — editoriale sectie */}
        <DescriptionSection product={product} />

        {/* Gerelateerd */}
        {relatedProducts.length > 0 && (
          <section className="mt-32 lg:mt-48">
            <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
              <div className="mb-14 lg:mb-20">
                <SectionHeader
                  number="02"
                  label="Meer uit deze collectie"
                  title="Gerelateerde"
                  titleItalic="producten"
                  linkHref={`/${product.category}`}
                  linkLabel="Alles bekijken"
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-14 sm:gap-x-6 sm:gap-y-20">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Sticky mobile CTA */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-line z-40 px-5 py-3">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <p className="font-serif text-xl text-ink leading-none">
                {hasDiscount && (
                  <span className="text-sm text-stone/70 line-through mr-2">{formatPrice(activeListPrice)}</span>
                )}
                {formatPrice(activePrice)}
              </p>
              <p className="text-[11px] text-slate leading-none mt-1">
                {activeVariant ? `Maat ${activeVariant.label}` : shippingInfo.vatLabelShort}
              </p>
            </div>
            <button
              onClick={handleAddToCart}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-[10px] text-[11px] uppercase tracking-[0.2em] font-medium transition-colors ${
                added ? "bg-success text-white" : "bg-ink text-white hover:bg-accent"
              }`}
            >
              {added ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Toegevoegd
                </>
              ) : (
                <>
                  Voeg toe aan tas
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:hidden h-20" />
      </div>

      {/* Fullscreen Lightbox — via Portal naar document.body om stacking-context
          issues (transform-parents, SmoothScroll, overflow:hidden) te vermijden */}
      {mounted && createPortal(
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200] bg-ink/95 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Foto galerij"
          >
            {/* Close */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 lg:top-6 lg:right-6 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors z-20"
              aria-label="Sluiten"
            >
              <X className="w-6 h-6" strokeWidth={1.5} />
            </button>

            {/* Counter */}
            {images.length > 1 && (
              <div className="absolute top-6 left-6 lg:top-8 lg:left-8 text-white/70 text-[11px] uppercase tracking-[0.25em] z-20 font-medium">
                {lightboxIndex + 1} / {images.length}
              </div>
            )}

            {/* Carousel — slides buiten current ±1 zijn lazy om 10MB+
                upfront-bytes te besparen (4 foto's × 2400w) */}
            <div className="w-full h-full overflow-hidden" ref={lightboxRef}>
              <div className="flex h-full">
                {images.map((img, i) => {
                  const isNear = Math.abs(i - lightboxIndex) <= 1 ||
                    (lightboxIndex === 0 && i === images.length - 1) ||
                    (lightboxIndex === images.length - 1 && i === 0);
                  return (
                  <div
                    key={i}
                    className="relative flex-[0_0_100%] h-full flex items-center justify-center p-6 lg:p-20"
                  >
                    <div className="relative w-full h-full max-w-[1800px] max-h-[90vh] mx-auto">
                      <Image
                        src={cldOptimize(img, { w: 2400, upscale: true, sourceW: sourceWAt(i), quality: "auto:best" })}
                        alt={`${product.name} — ${i + 1}`}
                        fill
                        unoptimized
                        loading={isNear ? "eager" : "lazy"}
                        className="object-contain"
                        sizes="100vw"
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Arrows — desktop/tablet only, mobile swipes */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => lightboxApi?.scrollPrev()}
                  className="hidden sm:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center text-white/80 hover:text-white bg-white/5 hover:bg-white/15 backdrop-blur-sm transition-all z-20"
                  aria-label="Vorige foto"
                >
                  <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => lightboxApi?.scrollNext()}
                  className="hidden sm:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center text-white/80 hover:text-white bg-white/5 hover:bg-white/15 backdrop-blur-sm transition-all z-20"
                  aria-label="Volgende foto"
                >
                  <ChevronRight className="w-6 h-6" strokeWidth={1.5} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}
    </>
  );
}

function ColorVariantPicker({
  currentSlug,
  currentColorName,
  variants,
}: {
  currentSlug: string;
  currentColorName: string | null;
  variants: ColorVariant[];
}) {
  if (!variants || variants.length <= 1) return null;
  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone">Kleur</p>
        {currentColorName && (
          <p className="font-serif italic text-ink text-sm">{currentColorName}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {variants.map((v) => {
          const isCurrent = v.slug === currentSlug;
          const swatch = v.colorHex ?? "#CFCFCF";
          return (
            <Link
              key={v.id}
              href={`/products/${v.slug}`}
              aria-label={v.colorName ?? "Variant"}
              title={v.colorName ?? ""}
              className={`relative w-10 h-10 border-2 transition-all ${
                isCurrent
                  ? "border-ink scale-100"
                  : "border-line hover:border-accent hover:scale-105"
              }`}
              style={{ backgroundColor: swatch }}
            >
              {isCurrent && (
                <span className="absolute inset-0 ring-2 ring-ink/0 ring-offset-2 ring-offset-paper" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StockDeliveryInfo({
  stock,
  deliveryTime,
}: {
  stock: number;
  deliveryTime: string | null;
}) {
  const hasStock = stock > 0;
  const lowStock = stock > 0 && stock <= 3;
  return (
    <div className="mb-10 flex flex-col gap-2.5 pb-6 border-b border-line">
      <div className="flex items-center gap-2.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            !hasStock ? "bg-red-700" : lowStock ? "bg-amber-600" : "bg-emerald-600"
          }`}
        />
        <span className="text-sm text-ink">
          {!hasStock
            ? "Tijdelijk uitverkocht"
            : lowStock
              ? `Nog ${stock} op voorraad`
              : "Op voorraad"}
        </span>
      </div>
      {deliveryTime && hasStock && (
        <p className="text-[12px] text-stone pl-4">
          Levertijd: <span className="text-ink">{deliveryTime}</span>
        </p>
      )}
    </div>
  );
}

function DescriptionSection({ product }: { product: Product }) {
  if (!product.description) return null;
  // Splits paragrafen op dubbele newlines, fallback naar 1 paragraaf
  const paragraphs = product.description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <section className="mt-24 lg:mt-40 bg-bone/40 py-20 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-5">
              Over dit stuk
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl text-ink leading-[1.1] mb-6">
              Het verhaal van{" "}
              <span className="italic text-accent">{product.name.split(" ")[0]}</span>
            </h2>
            <div className="w-10 h-[1px] bg-accent" />
          </div>
          <div className="lg:col-span-8 space-y-6">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? "font-serif text-xl lg:text-2xl text-ink leading-relaxed first-letter:font-medium"
                      : "text-base lg:text-lg text-slate leading-relaxed"
                  }
                >
                  {p}
                </p>
              ))
            ) : (
              <p className="font-serif text-xl lg:text-2xl text-ink leading-relaxed">
                {product.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroSpecs({ specs }: { specs: Record<string, string> }) {
  const entries = Object.entries(specs);
  if (entries.length === 0) return null;
  return (
    <details className="group border-t border-line mb-8">
      <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] uppercase tracking-[0.2em] text-ink font-medium">
          Specificaties
        </span>
        <svg
          className="w-4 h-4 text-stone shrink-0 transition-transform duration-300 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <dl className="pb-5">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="flex items-baseline justify-between gap-6 py-2.5 border-t border-line/60 first:border-t-0"
          >
            <dt className="text-[11px] uppercase tracking-[0.18em] text-stone shrink-0">{k}</dt>
            <dd className="text-sm text-ink text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
