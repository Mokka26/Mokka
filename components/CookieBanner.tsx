"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { businessInfo } from "@/lib/business-info";
import { Button } from "@/components/ui/Button";
import { applyConsent } from "@/lib/analytics";

const STORAGE_KEY = "mokka_cookie_consent_v1";

/**
 * CSS-variabele op <html> met de actuele hoogte van de banner (0 als dicht).
 * Vaste balken onderaan (PDP-koopbalk, filterknop) schuiven hiermee omhoog:
 * `bottom-[var(--cookie-banner-h,0px)]`.
 */
export const COOKIE_BANNER_HEIGHT_VAR = "--cookie-banner-h";

type Consent = "accepted" | "declined" | null;

export function getCookieConsent(): Consent {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    // localStorage geblokkeerd (private mode / strikte instellingen)
    return null;
  }
}

/**
 * Cookiemelding — wettelijk verplicht, dus wél bij page load, maar als
 * niet-modale `region`: steelt geen focus, blokkeert de pagina niet en
 * beide keuzes zijn visueel gelijkwaardig (CLAUDE.md §11: geen dark patterns).
 * Compact op mobiel: 2-3 regels tekst, knoppen naast elkaar.
 * Google-tag (GA4/Ads) draait in Consent Mode v2: cookies en identificatie pas
 * na "Accepteren" — zie components/Analytics.tsx en lib/analytics.ts.
 */
// Externe staat (localStorage) netjes via useSyncExternalStore: server kent
// geen keuze ("unknown" → dicht), client leest 'm en luistert naar wijzigingen.
function subscribeConsent(onChange: () => void) {
  window.addEventListener("cookieConsentChanged", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("cookieConsentChanged", onChange);
    window.removeEventListener("storage", onChange);
  };
}
const getServerConsent = (): Consent | "unknown" => "unknown";

export default function CookieBanner() {
  const consent = useSyncExternalStore(subscribeConsent, getCookieConsent, getServerConsent);
  // Vangnet als localStorage geblokkeerd is: keuze onthouden voor deze sessie.
  const [dismissed, setDismissed] = useState(false);
  const open = consent === null && !dismissed;
  const panelRef = useRef<HTMLElement>(null);

  // Hoogte van de banner doorgeven aan de pagina (zie COOKIE_BANNER_HEIGHT_VAR).
  useEffect(() => {
    const root = document.documentElement;
    const panel = panelRef.current;
    if (!open || !panel) {
      root.style.removeProperty(COOKIE_BANNER_HEIGHT_VAR);
      return;
    }
    const update = () => root.style.setProperty(COOKIE_BANNER_HEIGHT_VAR, `${panel.offsetHeight}px`);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      root.style.removeProperty(COOKIE_BANNER_HEIGHT_VAR);
    };
  }, [open]);

  const handleChoice = (choice: "accepted" | "declined") => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // localStorage geblokkeerd — banner verbergt sowieso voor deze sessie
    }
    // Consent Mode v2-update naar Google (granted/denied), vóór het event.
    applyConsent(choice);
    // Custom event zodat tracking-libraries (en deze banner) reageren zonder reload
    window.dispatchEvent(new CustomEvent("cookieConsentChanged", { detail: choice }));
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          ref={panelRef}
          role="region"
          aria-label="Cookievoorkeuren"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-[60] bg-white border-t border-line shadow-[0_-12px_40px_-12px_rgba(20,17,13,0.15)]"
        >
          <div className="max-w-[1600px] mx-auto px-4 sm:px-10 lg:px-14 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-10">
              <p className="text-[15px] sm:text-base text-slate leading-[1.5] lg:flex-1">
                We gebruiken functionele cookies en, na je akkoord, cookies voor statistiek en advertenties.{" "}
                <Link
                  href={businessInfo.legal.cookiePolicyUrl}
                  className="underline underline-offset-2 text-ink hover:text-accent-dark transition-colors whitespace-nowrap"
                >
                  Lees het cookiebeleid
                </Link>
              </p>

              {/* Beide knoppen identiek gestyled: weigeren is even makkelijk als accepteren. */}
              <div className="grid grid-cols-2 gap-3 lg:flex lg:shrink-0">
                <Button variant="secondary" size="sm" onClick={() => handleChoice("declined")} className="w-full lg:w-auto">
                  Weigeren
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleChoice("accepted")} className="w-full lg:w-auto">
                  Accepteren
                </Button>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
