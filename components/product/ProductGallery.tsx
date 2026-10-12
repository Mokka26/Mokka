"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { Maximize2 } from "lucide-react";
import { cldOptimize, cloudinaryLoader } from "@/lib/cloudinary-url";
import type { ProductImage } from "@/lib/imageHelpers";
import { GALLERY_ASPECT_CLASS, type Orientation } from "@/components/product/imageAspect";

interface Props {
  images: ProductImage[];
  productName: string;
  orientation: Orientation;
  /** Opent de lightbox op de gegeven foto. */
  onOpen: (index: number) => void;
}

export function galleryAlt(productName: string, img: ProductImage | undefined, index: number, total: number): string {
  if (img?.alt) return `${productName} — ${img.alt}`;
  return total > 1 ? `${productName} — foto ${index + 1} van ${total}` : productName;
}

/**
 * Eén galerij voor alle schermformaten: embla-carrousel met het hoofdbeeld
 * (swipen op mobiel; op desktop uitgeschakeld en gestuurd via thumbnails),
 * daardoor staat elke foto maar één keer in de DOM en heeft alleen de eerste
 * foto `priority`. De verhouding volgt de echte foto (object-contain op bone)
 * zodat banken volledig in beeld staan.
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
        <span className="text-[14px] uppercase tracking-[0.18em]">Foto volgt</span>
      </div>
    );
  }

  return (
    <div className="lg:flex lg:gap-5">
      {/* Thumbnails — desktop */}
      {total > 1 && (
        <ul className="hidden lg:flex flex-col gap-3 shrink-0 w-[88px]" aria-label="Foto's">
          {images.map((img, i) => {
            const current = active === i;
            return (
              <li key={`${img.url}-${i}`}>
                <button
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Toon foto ${i + 1} van ${total}`}
                  aria-current={current ? "true" : undefined}
                  className={`relative block w-[80px] h-[80px] overflow-hidden bg-bone rounded-md border transition-[opacity,border-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    current ? "opacity-100 border-ink" : "opacity-60 border-transparent hover:opacity-100 hover:border-mist"
                  }`}
                >
                  <Image
                    src={cldOptimize(img.url, { ar: "1:1", w: 160, mode: "pad", quality: "auto:good" })}
                    alt=""
                    fill
                    loading="lazy"
                    unoptimized
                    className="object-contain"
                    sizes="80px"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex-1 min-w-0">
        <div className="relative overflow-hidden bg-bone rounded-[10px]" ref={emblaRef}>
          <div className="flex">
            {images.map((img, i) => (
              <div key={`${img.url}-${i}`} className="flex-[0_0_100%] min-w-0">
                <button
                  type="button"
                  onClick={() => onOpen(i)}
                  aria-label={`Vergroot foto ${i + 1} van ${total}`}
                  className={`group/zoom relative block w-full ${aspect} cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent`}
                >
                  <Image
                    src={cldOptimize(img.url, { w: 1600, upscale: true, sourceW: img.w, quality: "auto:good" })}
                    alt={galleryAlt(productName, img, i, total)}
                    fill
                    priority={i === 0}
                    // Alleen foto 1 eager (LCP); de rest pas bij swipen/klikken.
                    loading={i === 0 ? "eager" : "lazy"}
                    loader={cloudinaryLoader}
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-contain"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 bg-white/90 text-ink text-[13px] px-3 py-1.5 rounded-full opacity-100 lg:opacity-0 lg:group-hover/zoom:opacity-100 lg:group-focus-visible/zoom:opacity-100 transition-opacity"
                  >
                    <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Vergroten
                  </span>
                </button>
              </div>
            ))}
          </div>
          {total > 1 && (
            <div className="lg:hidden absolute bottom-3 left-3 bg-white/90 px-3 py-1.5 text-[13px] text-ink rounded-full tabular-nums" aria-hidden="true">
              {active + 1} / {total}
            </div>
          )}
        </div>

        {/* Dots — mobiel, 24px klikgebied */}
        {total > 1 && (
          <div className="lg:hidden flex justify-center gap-1 mt-3" role="group" aria-label="Foto kiezen">
            {images.map((img, i) => (
              <button
                key={`${img.url}-dot-${i}`}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Ga naar foto ${i + 1} van ${total}`}
                aria-current={active === i ? "true" : undefined}
                className="inline-flex items-center justify-center w-6 h-6 min-w-6 focus-visible:outline-2 focus-visible:outline-accent rounded-full"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-all duration-300 ${active === i ? "w-5 bg-ink" : "w-1.5 bg-mist"}`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
