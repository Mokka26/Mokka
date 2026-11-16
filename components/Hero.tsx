import { Fragment } from "react";
import Link from "next/link";
import { getImageProps } from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cappedCloudinaryLoader, cldOptimize, cloudinaryLoader } from "@/lib/cloudinary-url";
import { HERO_IMAGE_ALT, HERO_IMAGE_SOURCE, HERO_VIDEO } from "@/lib/hero-image";
import { HeroVideo } from "@/components/home/HeroVideo";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { productUrl } from "@/lib/category-routes";
import { Price } from "@/components/ui/price";
import { stagger } from "@/components/home/motion";

// Server component. Filmische hero zonder video: één foto die bij het laden
// rustig inzoomt (.hero-settle) en bij scrollen trager meebeweegt dan de
// pagina (.hero-drift, scroll-gekoppeld). De kop schuift woord voor woord
// op zijn plek (alleen transform: de tekst is vanaf de eerste paint leesbaar).
// Alle beweging staat in globals.css achter prefers-reduced-motion; de
// server-HTML is volledig zichtbaar.
//
// Art direction met één <picture>: op mobiel een staande 3:4-crop, vanaf md
// een liggende 16:9. Beide srcSets uit next/image (getImageProps +
// cloudinaryLoader) en beide gepreload met een media-query (<link> in JSX,
// zie hieronder). Het <img> is de
// LCP-kandidaat: loading="eager" + fetchpriority="high".
const MD_QUERY = "(min-width: 768px)";
const MOBILE_QUERY = "(max-width: 767.98px)";

// Mobiel: q_auto (niet auto:good) en max. 1080 breed — bij DPR 2,6 vroeg
// sizes="100vw" anders w_1440 (3:4 = 1440×1920) voor een scherm van ~412px.
const MOBILE_SRC = cldOptimize(HERO_IMAGE_SOURCE, { ar: "3:4", w: 828, mode: "fill", quality: "auto" });
const DESKTOP_SRC = cldOptimize(HERO_IMAGE_SOURCE, { ar: "16:9", w: 1920, mode: "fill", quality: "auto:good" });
const MOBILE_MAX_WIDTH = 1080;

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

  const { props: mobile } = getImageProps({ ...shared, src: MOBILE_SRC, loader: cappedCloudinaryLoader(MOBILE_MAX_WIDTH) });
  const { props: desktop } = getImageProps({ ...shared, src: DESKTOP_SRC });

  return (
    <section className="relative isolate flex items-end min-h-[92svh] md:min-h-[100svh] bg-ink overflow-hidden">
      {/* Preload als JSX-<link> (React hoist 'm naar <head>), niet via
          react-dom preload(): die hint reist mee in de RSC-payload, waardoor
          élke pagina die "/" prefetcht (logo-link) de hero-foto downloadde.
          Een <link> in de boom geldt alleen als de home echt rendert. */}
      <link rel="preload" as="image" href={mobile.src} imageSrcSet={mobile.srcSet} imageSizes={mobile.sizes} media={MOBILE_QUERY} fetchPriority="high" />
      <link rel="preload" as="image" href={desktop.src} imageSrcSet={desktop.srcSet} imageSizes={desktop.sizes} media={MD_QUERY} fetchPriority="high" />
      {/* Foto (LCP) met daaroverheen, na het laden, de stille sfeervideo. */}
      <HeroVideo srcLarge={HERO_VIDEO.large} srcSmall={HERO_VIDEO.small}>
        <picture>
          <source media={MD_QUERY} srcSet={desktop.srcSet} sizes={desktop.sizes} />
          <img {...mobile} alt={HERO_IMAGE_ALT} className="object-cover" />
        </picture>
      </HeroVideo>

      {/* Leesbaarheid: een scrim achter het hele tekstblok, niet alleen onderin.
          Onderste 55% minimaal ink/70 (wit erop ≥ 4,5:1, ook op de lichtste
          pixel van de foto); daarboven loopt hij af naar ink/20. Vanaf lg
          extra links-verloop onder de kop, die daar hoger begint. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/70 via-55% to-ink/20" aria-hidden />
      <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-ink/60 via-ink/30 via-50% to-transparent" aria-hidden />

      <div className="relative z-10 w-full max-w-page mx-auto px-6 sm:px-10 lg:px-14 pt-40 lg:pt-48 pb-12 sm:pb-16 lg:pb-20 hero-content-out">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8 text-white">
            <p className="hero-fade [--delay:0ms] text-sm font-medium uppercase tracking-label text-white text-balance mb-6 flex items-center gap-3">
              <span className="hidden sm:block h-px w-10 shrink-0 bg-accent-light" aria-hidden />
              <span>
                Showroom in {city}
                <span className="hidden sm:inline"> · online bestellen</span>
              </span>
            </p>

            <h1 className="font-serif text-[clamp(2.5rem,6.6vw,6rem)] leading-[1.02] tracking-[-0.035em] text-balance mb-7">
              {/* Spatie buiten de inline-block span, anders valt hij weg. */}
              {HEADLINE_WORDS.map((word, i) => (
                <Fragment key={`${word}-${i}`}>
                  <span className={`hero-word ${stagger(i)}`}>{word}</span>
                  {i < HEADLINE_WORDS.length - 1 ? " " : null}
                </Fragment>
              ))}
            </h1>

            <p className="hero-fade [--delay:250ms] text-lg lg:text-xl leading-[1.6] text-white max-w-xl mb-10">
              {`Bestel online of bekijk de collectie in onze showroom in ${city}. Gratis verzending vanaf €${threshold}, prijzen incl. btw.`}
            </p>

            <div className="hero-fade [--delay:350ms] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
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
                className="hero-fade [--delay:450ms] group flex items-center gap-5 rounded-[14px] bg-ink/55 backdrop-blur-md border border-white/20 pl-5 pr-4 py-4 text-white hover:bg-ink/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white transition-colors"
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
