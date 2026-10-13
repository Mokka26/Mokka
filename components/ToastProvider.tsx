"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";

const MOBILE_QUERY = "(max-width: 1023px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
const getIsMobile = () => window.matchMedia(MOBILE_QUERY).matches;
const getServerIsMobile = () => false;

/**
 * Toasts (sonner) in merkstijl via tokens — geen losse hex.
 * - Mobiel: top-center, boven de sticky koop-/afrekenbalk uit.
 * - Desktop: rechtsonder.
 * - Sluitknop, 5 s zichtbaar, tekst ≥14px; reduced-motion volgt globals.css.
 * - Titel kort ("Toegevoegd aan je winkelwagen"), beschrijving op één regel.
 */
export default function ToastProvider() {
  const isMobile = useSyncExternalStore(subscribe, getIsMobile, getServerIsMobile);
  return (
    <Toaster
      position={isMobile ? "top-center" : "bottom-right"}
      closeButton
      duration={5000}
      offset={24}
      mobileOffset={{ top: 88, left: 16, right: 16 }}
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            "!bg-ink !text-paper !border !border-graphite !rounded-[10px] !shadow-lg !px-4 sm:!px-5 !py-3.5 sm:!py-4 !gap-3 sm:!max-w-[420px] font-sans",
          title: "!text-[15px] !leading-snug !font-medium",
          // Eén regel: productnaam + aantal; lange namen worden afgekapt.
          description: "!block !truncate !text-[14px] !leading-snug !text-paper/80",
          actionButton: "!bg-paper !text-ink !text-[14px] !font-medium !rounded-[8px] !h-9 !px-3",
          cancelButton: "!bg-transparent !text-paper/80 !text-[14px] !h-9 !px-3",
          closeButton: "!bg-ink !text-paper !border-graphite hover:!bg-graphite !w-7 !h-7",
          icon: "!text-accent-light",
        },
      }}
    />
  );
}
