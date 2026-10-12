import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cldOptimize } from "@/lib/cloudinary-url";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { HERO_IMAGE_ALT, HERO_IMAGE_SOURCE } from "@/lib/hero-image";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";

// Server component. Eén next/image met priority = de LCP-kandidaat staat als
// <link rel=preload> + <img fetchpriority=high> in de server-HTML; geen
// Three.js, geen scroll-hijack, geen onzichtbare-maar-focusbare links.
//
// 4:3-crop: op mobiel (portrait, ~72svh) blijft de bed-foto scherp zonder
// een te zware 1:1; op desktop (landscape) snijdt object-cover boven/onder af.
const HERO_SRC = cldOptimize(HERO_IMAGE_SOURCE, {
  ar: "4:3",
  w: 1920,
  mode: "fill",
  quality: "auto:good",
});

export default function Hero() {
  const city = businessInfo.address.city;
  const threshold = shippingInfo.freeShippingThreshold;
  const days = shippingInfo.returnWindowDays;

  return (
    <section className="relative h-[72svh] min-h-[480px] md:h-[80svh] md:max-h-[900px] bg-bone overflow-hidden">
      <CloudinaryImage
        src={HERO_SRC}
        alt={HERO_IMAGE_ALT}
        fill
        priority
        sizes="100vw"
        quality={75}
        className="object-cover"
      />
      {/* Leesbaarheidslaag: donker onderin waar de tekst staat (contrast ≥ 4.5:1
          voor wit op ink/75), bovenin blijft de foto licht. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/35 to-ink/5"
        aria-hidden
      />

      <div className="relative z-10 h-full flex items-end">
        <div className="max-w-[1600px] mx-auto w-full px-6 sm:px-10 lg:px-14 pb-12 sm:pb-16 lg:pb-20">
          <div className="max-w-2xl text-white">
            <h1 className="font-serif text-[2.25rem] leading-[1.08] sm:text-5xl lg:text-6xl tracking-[-0.02em] mb-5">
              Banken, eettafels en bedden die je thuis kunt uitproberen
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
