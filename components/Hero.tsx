import { Fragment } from "react";
import Link from "next/link";
import { getImageProps } from "next/image";
import { preload } from "react-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cldOptimize, cloudinaryLoader } from "@/lib/cloudinary-url";
import { HERO_IMAGE_ALT, HERO_IMAGE_SOURCE } from "@/lib/hero-image";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { productUrl } from "@/lib/categories";
import { Price } from "@/components/ui/price";
import { stagger } from "@/components/home/motion";

// Server component. Filmische hero zonder video: één foto die bij het laden
// rustig inzoomt (.hero-settle) en bij scrollen trager meebeweegt dan de
// pagina (.hero-drift, scroll-gekoppeld). De kop verschijnt woord voor woord.
// Alle beweging staat in globals.css achter prefers-reduced-motion; de
// server-HTML is volledig zichtbaar.
//
// Art direction met één <picture>: op mobiel een staande 3:4-crop, vanaf md
// een liggende 16:9. Beide srcSets uit next/image (getImageProps +
// cloudinaryLoader) en beide gepreload met een media-query. Het <img> is de
// LCP-kandidaat: loading="eager" + fetchpriority="high".
const MD_QUERY = "(min-width: 768px)";
const MOBILE_QUERY = "(max-width: 767.98px)";

const MOBILE_SRC = cldOptimize(HERO_IMAGE_SOURCE, { ar: "3:4", w: 828, mode: "fill", quality: "auto:good" });
const DESKTOP_SRC = cldOptimize(HERO_IMAGE_SOURCE, { ar: "16:9", w: 1920, mode: "fill", quality: "auto:good" });

const shared = {
  alt: HERO_IMAGE_ALT,
  fill: true,
  sizes: "100vw",
  loader: cloudinaryLoader,
  loading: "eager",
  fetchPriority: "high",
} as const;

const HEADLINE_WORDS = "Banken, eettafels en bedden voor elke kamer in huis".split(" ");

export interface HeroProduct {
  name: string;
  slug: string;
  category: string;
  price: number;
  listPrice: number | null;
}

export default function Hero({ product }: { product?: HeroProduct | null }) {
  const city = businessInfo.address.city;
  const threshold = shippingInfo.freeShippingThreshold;

  const { props: mobile } = getImageProps({ ...shared, src: MOBILE_SRC });
  const { props: desktop } = getImageProps({ ...shared, src: DESKTOP_SRC });

  preload(mobile.src, { as: "image", imageSrcSet: mobile.srcSet, imageSizes: mobile.sizes, media: MOBILE_QUERY, fetchPriority: "high" });
  preload(desktop.src, { as: "image", imageSrcSet: desktop.srcSet, imageSizes: desktop.sizes, media: MD_QUERY, fetchPriority: "high" });

  return (
    <section className="relative isolate flex items-end min-h-[92svh] md:min-h-[100svh] bg-ink overflow-hidden">
      {/* Twee lagen: buitenste beweegt mee met scrollen, binnenste zoomt bij laden. */}
      <div className="absolute inset-0 hero-drift">
        <div className="absolute inset-0 hero-settle">
          <picture>
            <source media={MD_QUERY} srcSet={desktop.srcSet} sizes={desktop.sizes} />
            <img {...mobile} alt={HERO_IMAGE_ALT} className="object-cover" />
          </picture>
        </div>
      </div>

      {/* Leesbaarheid: donker onderin waar de tekst staat (wit op ink/80 ≥ 4.5:1),
          links iets donkerder voor de kop op brede schermen. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/0" aria-hidden />
      <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-ink/45 via-ink/10 to-transparent" aria-hidden />

      <div className="relative z-10 w-full max-w-page mx-auto px-6 sm:px-10 lg:px-14 pt-40 lg:pt-48 pb-12 sm:pb-16 lg:pb-20 hero-content-out">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8 text-white">
            <p className="hero-fade [--delay:100ms] text-sm font-medium uppercase tracking-label text-white/90 mb-6 flex items-center gap-3">
              <span className="h-px w-10 bg-accent-light" aria-hidden />
              Showroom in {city} · online bestellen
            </p>

            <h1 className="font-serif text-[clamp(2.5rem,6.6vw,6rem)] leading-[1.02] tracking-[-0.035em] mb-7 [perspective:900px]">
              {/* Spatie buiten de inline-block span, anders valt hij weg. */}
              {HEADLINE_WORDS.map((word, i) => (
                <Fragment key={`${word}-${i}`}>
                  <span className={`hero-word ${stagger(i)}`}>{word}</span>
                  {i < HEADLINE_WORDS.length - 1 ? " " : null}
                </Fragment>
              ))}
            </h1>

            <p className="hero-fade [--delay:900ms] text-lg lg:text-xl leading-[1.6] text-white/90 max-w-xl mb-10">
              {`Bestel online of bekijk de collectie in onze showroom in ${city}. Gratis verzending vanaf €${threshold}, prijzen incl. btw.`}
            </p>

            <div className="hero-fade [--delay:1100ms] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <Link
                href="/banken"
                className="group inline-flex items-center justify-center gap-3 min-h-11 bg-white text-ink px-8 py-4 rounded-[10px] text-sm font-medium tracking-label uppercase hover:bg-accent-dark hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white transition-colors"
              >
                Bekijk banken
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} aria-hidden />
              </Link>
              <Link
                href="/showroom"
                className="inline-flex items-center gap-2 min-h-11 text-sm font-medium uppercase tracking-label text-white underline decoration-white/50 underline-offset-[6px] hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Bezoek de showroom
                <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} aria-hidden />
              </Link>
            </div>
          </div>

          {product && product.price > 0 && (
            <div className="lg:col-span-4 hidden lg:flex justify-end">
              <Link
                href={productUrl(product)}
                className="hero-fade [--delay:1400ms] group flex items-center gap-5 rounded-[14px] bg-ink/55 backdrop-blur-md border border-white/20 pl-5 pr-4 py-4 text-white hover:bg-ink/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-white/80">Op de foto</span>
                  <span className="block font-serif text-xl leading-tight">{product.name}</span>
                  <Price
                    value={product.price}
                    listPrice={product.listPrice}
                    showSavings={false}
                    vat
                    className="font-serif text-lg text-white tabular-nums"
                    vatClassName="text-sm text-white/80"
                  />
                </span>
                <span className="w-11 h-11 shrink-0 rounded-full bg-white text-ink flex items-center justify-center transition-transform group-hover:rotate-45" aria-hidden>
                  <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Scroll-hint: decoratief, stopt na twee rondes. */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:block h-12 w-px bg-white/25 overflow-hidden" aria-hidden>
        <span className="block h-full w-full bg-white scroll-cue" />
      </div>
    </section>
  );
}
