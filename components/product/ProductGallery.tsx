"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { cldOptimize, cloudinaryLoader } from "@/lib/cloudinary-url";
import { frameMode, type ProductImage } from "@/lib/imageHelpers";
import { GALLERY_ASPECT_CLASS, GALLERY_ASPECT_RATIO, type Orientation } from "@/components/product/imageAspect";

interface Props {
  images: ProductImage[];
  productName: string;
  orientation: Orientation;
  /** Opent de lightbox op de gegeven foto. */
  onOpen: (index: number) => void;
}

/** Vanaf dit aantal foto's geen bolletjes meer (lopen anders over op 2 regels) maar een voortgangsbalk. */
const MAX_DOTS = 6;

export function galleryAlt(productName: string, img: ProductImage | undefined, index: number, total: number): string {
  if (img?.alt) return `${productName} — ${img.alt}`;
  return total > 1 ? `${productName} — foto ${index + 1} van ${total}` : productName;
}

/**
 * Eén galerij voor alle schermformaten: embla-carrousel met het hoofdbeeld
 * (swipen op mobiel; op desktop uitgeschakeld en gestuurd via thumbnails),
 * daardoor staat elke foto maar één keer in de DOM en heeft alleen de eerste
 * foto `priority`. De verhouding volgt de echte foto; Cloudinary brengt elke
 * foto op die verhouding (zie frameMode in lib/imageHelpers.ts) zodat het
 * kader gevuld is zonder zichtbare band.
 */
export function ProductGallery({ images, productName, orientation, onOpen }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    breakpoints: { "(min-width: 1024px)": { watchDrag: false, duration: 0 } },
  });
  const [active, setActive] = useState(0);
  const aspect = GALLERY_ASPECT_CLASS[orientation];
  const total = images.length;

  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Thumbnails: roving tabindex — één tabstop; pijltjes, Home en End wisselen
  // van foto en verplaatsen de focus mee.
  const onThumbKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = total - 1;
    const keyTarget: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowRight: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      ArrowLeft: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    const next = keyTarget[e.key];
    if (next === undefined) return;
    e.preventDefault();
    scrollTo(next);
    setActive(next);
    thumbRefs.current[next]?.focus();
  };

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActive(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  if (total === 0) {
    return (
      <div className={`relative ${aspect} w-full bg-bone rounded-[10px] flex flex-col items-center justify-center gap-2 text-stone`}>
        <span aria-hidden="true" className="w-10 h-px bg-accent" />
        <span className="eyebrow-lg">Foto volgt</span>
      </div>
    );
  }

  return (
    <div className="lg:flex lg:gap-5">
      {/* Thumbnails — desktop */}
      {total > 1 && (
        <ul className="hidden lg:flex flex-col gap-3 shrink-0 w-[88px]" aria-label="Foto's (pijltjestoetsen om te wisselen)" onKeyDown={onThumbKeyDown}>
          {images.map((img, i) => {
            const current = active === i;
            return (
              <li key={`${img.url}-${i}`}>
                <button
                  ref={(el) => {
                    thumbRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => scrollTo(i)}
                  tabIndex={current ? 0 : -1}
                  aria-label={`Toon foto ${i + 1} van ${total}`}
                  aria-current={current ? "true" : undefined}
                  className={`relative block w-[80px] h-[80px] overflow-hidden bg-bone rounded-md border transition-[opacity,border-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    current ? "opacity-100 border-ink" : "opacity-60 border-transparent hover:opacity-100 hover:border-mist"
                  }`}
                >
                  <Image
                    src={cldOptimize(img.url, { ar: "1:1", w: 160, mode: frameMode(img), quality: "auto:good" })}
                    alt=""
                    fill
                    loading="lazy"
                    unoptimized
                    className="object-cover"
                    sizes="80px"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex-1 min-w-0">
        <div
          className="relative overflow-hidden bg-bone rounded-[10px]"
          ref={emblaRef}
          role="region"
          aria-roledescription="carousel"
          aria-label={`Foto's van ${productName}`}
        >
          <div className="flex">
            {images.map((img, i) => (
              <div
                key={`${img.url}-${i}`}
                className="flex-[0_0_100%] min-w-0"
                role="group"
                aria-roledescription="dia"
                aria-label={`${i + 1} van ${total}`}
                // Alleen de zichtbare dia is bereikbaar: anders 1 tabstop per foto
                // naar onzichtbare dia's (de miniaturen/swipe wisselen van foto).
                aria-hidden={i === active ? undefined : true}
                inert={i === active ? undefined : true}
              >
                <button
                  type="button"
                  onClick={() => onOpen(i)}
                  aria-label={`Vergroot foto ${i + 1} van ${total}`}
                  className={`group/zoom relative block w-full ${aspect} cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink`}
                >
                  <Image
                    // Cloudinary brengt de foto zelf op de galerijverhouding (vrijstaand:
                    // opvullen in randkleur, sfeerfoto: slim bijsnijden); object-cover, geen band.
                    src={cldOptimize(img.url, { ar: GALLERY_ASPECT_RATIO[orientation], mode: frameMode(img), w: 1600, upscale: true, sourceW: img.w, quality: "auto:good" })}
                    alt={galleryAlt(productName, img, i, total)}
                    fill
                    priority={i === 0}
                    // Alleen foto 1 eager (LCP); de rest pas bij swipen/klikken.
                    loading={i === 0 ? "eager" : "lazy"}
                    loader={cloudinaryLoader}
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-cover"
                  />
                  {/* Vergroot-hint: op mobiel alleen het icoon (rechtsonder), op
                      desktop met tekst bij hover/focus. De teller staat rechtsboven. */}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 right-3 inline-flex items-center justify-center gap-1.5 bg-white/90 text-ink text-sm w-11 h-11 lg:w-auto lg:h-auto lg:px-3 lg:py-1.5 rounded-full opacity-100 lg:opacity-0 lg:group-hover/zoom:opacity-100 lg:group-focus-visible/zoom:opacity-100 transition-opacity"
                  >
                    <Maximize2 className="w-4 h-4 lg:w-3.5 lg:h-3.5" strokeWidth={1.75} />
                    <span className="hidden lg:inline">Vergroten</span>
                  </span>
                </button>
              </div>
            ))}
          </div>
          {total > 1 && (
            <div className="lg:hidden absolute top-3 right-3 bg-white/90 px-3 py-1.5 text-sm text-ink rounded-full tabular-nums" aria-hidden="true">
              {active + 1} / {total}
            </div>
          )}
          {total > 1 && (
            <p className="sr-only" aria-live="polite">
              Foto {active + 1} van {total}
            </p>
          )}
        </div>

        {/* Dots — mobiel: visueel klein, klikgebied 44×44px. Bij meer dan
            MAX_DOTS foto's een voortgangsbalk met vorige/volgende-knoppen
            (alternatief voor swipen, WCAG 2.5.7). */}
        {total > 1 && total <= MAX_DOTS && (
          <div className="lg:hidden flex justify-center mt-1" role="group" aria-label="Foto kiezen">
            {images.map((img, i) => (
              <button
                key={`${img.url}-dot-${i}`}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Ga naar foto ${i + 1} van ${total}`}
                aria-current={active === i ? "true" : undefined}
                className="inline-flex items-center justify-center w-11 h-11 min-w-11 focus-visible:outline-2 focus-visible:outline-ink rounded-full"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-all duration-300 ${active === i ? "w-5 bg-ink" : "w-1.5 bg-mist"}`}
                />
              </button>
            ))}
          </div>
        )}
        {total > MAX_DOTS && (
          <div className="lg:hidden flex items-center gap-2 mt-1" role="group" aria-label="Foto kiezen">
            <button
              type="button"
              onClick={() => scrollTo(Math.max(active - 1, 0))}
              disabled={active === 0}
              aria-label="Vorige foto"
              className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full text-ink disabled:text-line-strong focus-visible:outline-2 focus-visible:outline-ink"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
            {/* Voortgangsbalk in segmenten (geen inline style nodig); de teller
                staat rechtsboven in de foto en de sr-only live-regio meldt de foto. */}
            <span aria-hidden="true" className="flex flex-1 gap-1">
              {images.map((img, i) => (
                <span
                  key={`${img.url}-bar-${i}`}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= active ? "bg-ink" : "bg-mist"}`}
                />
              ))}
            </span>
            <button
              type="button"
              onClick={() => scrollTo(Math.min(active + 1, total - 1))}
              disabled={active === total - 1}
              aria-label="Volgende foto"
              className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full text-ink disabled:text-line-strong focus-visible:outline-2 focus-visible:outline-ink"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
