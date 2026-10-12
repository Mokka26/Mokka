"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogCloseButton } from "@/components/ui/Dialog";
import { cldOptimize } from "@/lib/cloudinary-url";
import type { ProductImage } from "@/lib/imageHelpers";
import { galleryAlt } from "@/components/product/ProductGallery";

interface Props {
  images: ProductImage[];
  productName: string;
  startIndex: number;
  onClose: () => void;
}

/**
 * Fullscreen-lightbox op het native <dialog>-element (focus-trap, Esc, focus
 * terug naar de opener). Wordt pas geladen (next/dynamic) én gemount als de
 * bezoeker een foto vergroot — embla en de grote foto's kosten anders bytes
 * op elke productpagina.
 */
export default function ProductLightbox({ images, productName, startIndex, onClose }: Props) {
  const total = images.length;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: total > 1, startIndex });
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Pijltjestoetsen — Esc regelt het <dialog>-element zelf.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") emblaApi?.scrollPrev();
      if (e.key === "ArrowRight") emblaApi?.scrollNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emblaApi]);

  return (
    <Dialog
      open
      onClose={onClose}
      size="full"
      title={`Foto's van ${productName}`}
      className="bg-ink text-paper"
      header={
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 min-h-16 shrink-0 text-paper">
          <p className="text-[14px] tabular-nums" aria-live="polite">
            <span className="sr-only">Foto </span>
            {index + 1} / {total}
          </p>
          <div className="text-paper [&_button]:text-paper [&_button:hover]:bg-paper/10">
            <DialogCloseButton onClick={onClose} label="Lightbox sluiten" />
          </div>
        </div>
      }
    >
      <div className="relative h-full min-h-[70vh]">
        <div className="h-full overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {images.map((img, i) => {
              const isNear = total <= 3 || Math.abs(i - index) <= 1 || (index === 0 && i === total - 1) || (index === total - 1 && i === 0);
              return (
                <div key={`${img.url}-${i}`} className="relative flex-[0_0_100%] min-w-0 h-full p-4 sm:p-8 lg:p-16">
                  <div className="relative w-full h-full min-h-[60vh]">
                    <Image
                      src={cldOptimize(img.url, { w: 2400, upscale: true, sourceW: img.w, quality: "auto:best" })}
                      alt={galleryAlt(productName, img, i, total)}
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

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute left-2 lg:left-6 top-1/2 -translate-y-1/2 w-12 h-12 inline-flex items-center justify-center rounded-full text-paper bg-paper/10 hover:bg-paper/20 transition-colors focus-visible:outline-2 focus-visible:outline-accent-light"
              aria-label="Vorige foto"
            >
              <ChevronLeft className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              className="absolute right-2 lg:right-6 top-1/2 -translate-y-1/2 w-12 h-12 inline-flex items-center justify-center rounded-full text-paper bg-paper/10 hover:bg-paper/20 transition-colors focus-visible:outline-2 focus-visible:outline-accent-light"
              aria-label="Volgende foto"
            >
              <ChevronRight className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
