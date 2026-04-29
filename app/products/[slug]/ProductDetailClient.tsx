"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { X, ChevronLeft, ChevronRight, Star } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { getReviewsFor, type Review } from "@/lib/productReviews";
import { cldOptimize } from "@/lib/cloudinary-url";
import { parseImages } from "@/lib/imageHelpers";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string;
  specs?: string | null;
  featured: boolean;
  stock?: number;
  deliveryTime?: string | null;
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
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

const usps = [
  { icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", label: "Gratis verzending", sub: "Boven €100" },
  { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", label: "2 jaar garantie", sub: "Op alle producten" },
  { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", label: "30 dagen retour", sub: "Gratis retourneren" },
];

export default function ProductDetailClient({ product, relatedProducts, colorVariants }: Props) {
  const images: string[] = parseImages(product.images).map((i) => i.url);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const { addToCart } = useCart();

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

  // Lightbox: sync swipe → index, jump to start index on open
  useEffect(() => {
    if (!lightboxApi) return;
    lightboxApi.scrollTo(lightboxIndex, true);
    const onSelect = () => setLightboxIndex(lightboxApi.selectedScrollSnap());
    lightboxApi.on("select", onSelect);
    return () => {
      lightboxApi.off("select", onSelect);
    };

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
    for (let i = 0; i < quantity; i++) {
      addToCart({ id: product.id, name: product.name, price: product.price, images: product.images, category: product.category });
    }
    toast.success(`${product.name} toegevoegd aan winkelwagen`, {
      description: `Aantal: ${quantity}`,
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
            <Link href="/" className="hover:text-bronze transition-colors">Home</Link>
            <span className="mx-3 text-mist">/</span>
            <Link href="/products" className="hover:text-bronze transition-colors">Producten</Link>
            <span className="mx-3 text-mist">/</span>
            <Link href={`/products?category=${product.category}`} className="hover:text-bronze transition-colors capitalize">{product.category}</Link>
            <span className="mx-3 text-mist">/</span>
            <span className="text-ink">{product.name}</span>
          </nav>
        </div>

        {/* Product — twee kolommen */}
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-start">
            {/* Afbeeldingen */}
            <div className="lg:col-span-7">
              {/* Mobile — swipe carousel */}
              <div className="lg:hidden">
                <div
                  className="relative overflow-hidden bg-bone cursor-zoom-in"
                  ref={emblaRef}
                  onClick={() => openLightbox(activeSlide)}
                >
                  <div className="flex">
                    {images.map((img, i) => (
                      <div
                        key={i}
                        className="relative flex-[0_0_100%] aspect-square bg-white"
                      >
                        <Image
                          src={cldOptimize(img, { w: 1100 })}
                          alt={`${product.name} — ${i + 1}`}
                          fill
                          priority={i === 0}
                          className="object-cover"
                          sizes="(max-width: 640px) 92vw, 88vw"
                        />
                      </div>
                    ))}
                  </div>
                  {images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-ink font-medium">
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
                <div className="flex flex-col gap-3 flex-shrink-0 w-[84px]">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      aria-label={`Toon foto ${i + 1}`}
                      className={`relative w-[84px] h-[104px] flex-shrink-0 overflow-hidden bg-bone transition-all duration-200 ${
                        selectedImage === i ? "opacity-100" : "opacity-50 hover:opacity-90"
                      }`}
                    >
                      <Image src={cldOptimize(img, { ar: "1:1", w: 200, mode: "fill" })} alt="" fill loading="lazy" className="object-cover" sizes="84px" />
                      {selectedImage === i && (
                        <span className="absolute inset-y-0 left-0 w-[2px] bg-ink" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Hoofd afbeelding met hover zoom */}
                <div
                  className="relative aspect-square flex-1 bg-white overflow-hidden cursor-zoom-in"
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
                        src={cldOptimize(images[selectedImage], { w: 1400 })}
                        alt={product.name}
                        fill
                        priority
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

            {/* Info — sticky op desktop */}
            <div className="lg:col-span-5 flex flex-col lg:sticky lg:top-32 lg:py-8">
              <div className="flex items-center gap-4 mb-6">
                <span className="font-serif italic text-stone text-sm">— 01</span>
                <span className="eyebrow capitalize">{product.category}</span>
              </div>
              <h1 className="display-lg text-ink mb-6">{product.name}</h1>
              <p className="font-serif text-3xl lg:text-4xl text-bronze font-light mb-10">&euro;{product.price.toFixed(2)}</p>

              <div className="w-12 h-[1px] bg-mist mb-10" />

              <p className="body-lg text-slate mb-10">{product.description}</p>

              <ColorVariantPicker
                currentSlug={product.slug}
                currentColorName={product.colorName ?? null}
                variants={colorVariants}
              />

              <ProductSpecs specs={parseSpecs(product.specs)} />

              <StockDeliveryInfo
                stock={product.stock ?? 0}
                deliveryTime={product.deliveryTime ?? null}
              />

              {/* Aantal + Knop */}
              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <div className="flex items-center border border-line">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={(product.stock ?? 0) === 0}
                    className="px-5 py-4 text-stone hover:text-bronze transition-colors text-sm disabled:opacity-40"
                  >−</button>
                  <span className="px-4 py-4 text-ink text-sm min-w-[3rem] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock ?? 99, quantity + 1))}
                    disabled={quantity >= (product.stock ?? 0)}
                    className="px-5 py-4 text-stone hover:text-bronze transition-colors text-sm disabled:opacity-40"
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

              {/* USP's */}
              <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 pt-10 border-t border-line">
                {usps.map((usp) => (
                  <div key={usp.label} className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-bronze flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={usp.icon} />
                    </svg>
                    <span className="text-stone text-[11px] uppercase tracking-[0.2em] font-medium">{usp.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <ProductReviews category={product.category} />

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
                  linkHref={`/products?category=${product.category}`}
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
              <p className="text-[10px] text-stone uppercase tracking-[0.2em] leading-none mb-1">Vanaf</p>
              <p className="font-serif text-xl text-ink leading-none">&euro;{product.price.toFixed(0)}</p>
            </div>
            <button
              onClick={handleAddToCart}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[11px] uppercase tracking-[0.2em] font-medium transition-colors ${
                added ? "bg-success text-white" : "bg-ink text-white hover:bg-bronze"
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

      {/* Fullscreen Lightbox */}
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

            {/* Carousel */}
            <div className="w-full h-full overflow-hidden" ref={lightboxRef}>
              <div className="flex h-full">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="relative flex-[0_0_100%] h-full flex items-center justify-center p-6 lg:p-20"
                  >
                    <div className="relative w-full h-full max-w-[1400px] max-h-[90vh] mx-auto">
                      <Image
                        src={img}
                        alt={`${product.name} — ${i + 1}`}
                        fill
                        className="object-contain"
                        sizes="100vw"
                      />
                    </div>
                  </div>
                ))}
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
      </AnimatePresence>
    </>
  );
}

function ProductReviews({ category }: { category: string }) {
  const reviews = getReviewsFor(category);
  if (reviews.length === 0) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return (
    <section className="mt-32 lg:mt-40 bg-paper">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <header className="mb-14 lg:mb-20 text-center">
          <p className="eyebrow mb-4">Wat klanten zeggen</p>
          <div className="flex items-center justify-center gap-2 mb-3">
            <StarRow rating={Math.round(avg) as 4 | 5} />
            <span className="text-stone text-sm font-serif italic">
              {avg.toFixed(1)} / 5
            </span>
          </div>
          <h2 className="font-serif text-3xl lg:text-5xl text-ink leading-[1]">
            Vertrouwd door <span className="italic">echte mensen</span>
          </h2>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {reviews.map((r, i) => (
            <ReviewCard key={`${r.name}-${i}`} review={r} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="bg-white border border-line p-8 lg:p-10 flex flex-col">
      <StarRow rating={review.rating} />
      <p className="font-serif italic text-ink text-lg lg:text-xl leading-relaxed mt-6 mb-8">
        &ldquo;{review.quote}&rdquo;
      </p>
      <div className="mt-auto pt-6 border-t border-line">
        <p className="text-sm text-ink">{review.name}</p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-stone mt-1">
          {review.city}
        </p>
      </div>
    </article>
  );
}

function StarRow({ rating }: { rating: 4 | 5 }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < rating ? "fill-bronze text-bronze" : "text-line"
          }`}
        />
      ))}
    </div>
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
                  : "border-line hover:border-bronze hover:scale-105"
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

function ProductSpecs({ specs }: { specs: Record<string, string> }) {
  const entries = Object.entries(specs);
  if (entries.length === 0) return null;
  return (
    <div className="mb-12">
      <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-4">Specificaties</p>
      <dl className="border-t border-line">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="flex items-baseline justify-between gap-6 py-3.5 border-b border-line"
          >
            <dt className="text-[11px] uppercase tracking-[0.2em] text-stone shrink-0">
              {k}
            </dt>
            <dd className="font-serif text-ink text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
