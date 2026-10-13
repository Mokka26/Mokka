import Link from "next/link";
import { getImageProps } from "next/image";
import { preload } from "react-dom";
import { ArrowRight } from "lucide-react";
import { cldOptimize, cloudinaryLoader } from "@/lib/cloudinary-url";
import { HERO_IMAGE_ALT, HERO_IMAGE_SOURCE } from "@/lib/hero-image";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";

// Server component. Art direction met één <picture>: op mobiel een staande
// 4:5-crop (g_auto houdt het bed in beeld, geen 16:9-strook van 375px breed),
// vanaf md een liggende 16:9. Beide srcSets komen uit next/image
// (getImageProps + cloudinaryLoader) zodat Cloudinary het resizen doet, en
// beide worden gepreload met een media-query: de browser haalt alleen de
// variant op die 'ie ook echt toont. Het <img> is de LCP-kandidaat:
// loading="eager" + fetchpriority="high".
const MD_QUERY = "(min-width: 768px)";
const MOBILE_QUERY = "(max-width: 767.98px)";

const MOBILE_SRC = cldOptimize(HERO_IMAGE_SOURCE, {
  ar: "4:5",
  w: 828,
  mode: "fill",
  quality: "auto:good",
});
const DESKTOP_SRC = cldOptimize(HERO_IMAGE_SOURCE, {
  ar: "16:9",
  w: 1920,
  mode: "fill",
  quality: "auto:good",
});

const shared = {
  alt: HERO_IMAGE_ALT,
  fill: true,
  sizes: "100vw",
  loader: cloudinaryLoader,
  loading: "eager",
  fetchPriority: "high",
} as const;

export default function Hero() {
  const city = businessInfo.address.city;
  const threshold = shippingInfo.freeShippingThreshold;
  const days = shippingInfo.returnWindowDays;

  const { props: mobile } = getImageProps({ ...shared, src: MOBILE_SRC });
  const { props: desktop } = getImageProps({ ...shared, src: DESKTOP_SRC });

  preload(mobile.src, {
    as: "image",
    imageSrcSet: mobile.srcSet,
    imageSizes: mobile.sizes,
    media: MOBILE_QUERY,
    fetchPriority: "high",
  });
  preload(desktop.src, {
    as: "image",
    imageSrcSet: desktop.srcSet,
    imageSizes: desktop.sizes,
    media: MD_QUERY,
    fetchPriority: "high",
  });

  return (
    <section className="relative h-[72svh] min-h-[600px] md:h-[80svh] md:max-h-[900px] bg-bone overflow-hidden">
      <picture>
        <source media={MD_QUERY} srcSet={desktop.srcSet} sizes={desktop.sizes} />
        {/* Props (src/srcSet/sizes/style/decoding) komen uit next/image (getImageProps). */}
        <img {...mobile} alt={HERO_IMAGE_ALT} className="object-cover" />
      </picture>
      {/* Leesbaarheidslaag: donker onderin waar de tekst staat (contrast ≥ 4.5:1
          voor wit op ink/75), bovenin blijft de foto licht. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/35 to-ink/5"
        aria-hidden
      />

      <div className="relative z-10 h-full flex items-end">
        <div className="max-w-[1600px] mx-auto w-full px-6 sm:px-10 lg:px-14 pb-12 sm:pb-16 lg:pb-20">
          <div className="max-w-2xl text-white">
            <h1 className="font-serif text-[2rem] leading-[1.08] sm:text-5xl lg:text-6xl tracking-[-0.02em] mb-5">
              Banken, eettafels en bedden die je eerst in de showroom kunt proberen
            </h1>
            <p className="text-lg lg:text-xl leading-[1.6] text-white/90 max-w-xl mb-8">
              Kom proefzitten in onze showroom in {city} of bestel online. Gratis
              verzending vanaf &euro;{threshold}, {days} dagen bedenktijd.
            </p>
            <Link
              href="/banken"
              className="inline-flex items-center gap-3 bg-white text-ink px-7 py-4 rounded-[10px] text-sm font-medium tracking-[0.08em] uppercase hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white transition-colors"
            >
              Bekijk banken
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
