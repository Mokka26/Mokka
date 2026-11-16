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

const FOCUS = "focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-accent-light";

/**
 * Toasts (sonner) in merkstijl via tokens — geen losse hex.
 * - Mobiel: top-center, boven de sticky koop-/afrekenbalk uit.
 * - Desktop: rechtsonder.
 * - Nooit breder dan het scherm: max. 420px of schermbreedte min 2rem.
 * - Tekst breekt af i.p.v. afgekapt te worden; sluitknop staat binnen de
 *   padding (rechtsboven), met een tikvlak van 44px.
 * - Actieknoppen (bv. "Bekijk winkelwagen" / "Afrekenen") op een eigen rij
 *   onder de tekst, 44px hoog. Standaard 5 s zichtbaar; met knoppen zet de
 *   aanroeper een langere duur. Reduced-motion volgt globals.css.
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
            "!bg-ink !text-paper !border !border-graphite !rounded-[10px] !shadow-lg !pl-4 sm:!pl-5 !pr-12 !py-3.5 sm:!py-4 !gap-x-3 !gap-y-3 !flex-wrap !items-start !max-w-[min(420px,calc(100vw-2rem))] font-sans",
          // Inhoud vult de eerste rij (naast het icoon); knoppen vallen eronder.
          content: "!min-w-0 !flex-1 !basis-[calc(100%-28px)]",
          title: "!text-[15px] !leading-snug !font-medium !break-words",
          description: "!block !whitespace-normal !break-words !text-[14px] !leading-snug !text-paper/80",
          actionButton: `!bg-paper !text-ink !text-[14px] !font-medium !rounded-[8px] !h-11 !px-4 !ml-[28px] [[data-cancel]~&]:!ml-0 hover:!bg-paper/90 ${FOCUS}`,
          cancelButton: `!bg-transparent !text-paper !border !border-paper/40 hover:!border-paper !text-[14px] !rounded-[8px] !h-11 !px-4 !ml-[28px] ${FOCUS}`,
          // Binnen de padding rechtsboven; zichtbaar 28px, tikvlak 44px via een onzichtbare rand (::after).
          closeButton: `!left-auto !right-2 !top-2 !transform-none !bg-ink !text-paper !border-graphite hover:!bg-graphite !w-7 !h-7 after:absolute after:-inset-2 after:content-[''] ${FOCUS}`,
          icon: "!text-accent-light !mt-0.5",
        },
      }}
    />
  );
}
