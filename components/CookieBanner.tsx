"use client";

import { useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { businessInfo } from "@/lib/business-info";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "mokka_cookie_consent_v1";

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
 * Tracking (Google Ads) laadt pas na "Accepteren" — zie GoogleAdsTag.
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

  const handleChoice = (choice: "accepted" | "declined") => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // localStorage geblokkeerd — banner verbergt sowieso voor deze sessie
    }
    // Custom event zodat tracking-libraries (en deze banner) reageren zonder reload
    window.dispatchEvent(new CustomEvent("cookieConsentChanged", { detail: choice }));
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          role="region"
          aria-label="Cookievoorkeuren"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-[60] bg-white border-t border-line shadow-[0_-12px_40px_-12px_rgba(20,17,13,0.15)]"
        >
          <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 py-6 lg:py-7">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
              <div className="lg:col-span-8">
                <h2 className="eyebrow-lg text-ink mb-2">Cookies</h2>
                <p className="text-base text-slate leading-relaxed">
                  We gebruiken functionele cookies voor de werking van de site (winkelwagen, inloggen),
                  analytische cookies om de webshop te verbeteren en marketingcookies (Google Ads) om
                  te meten of onze advertenties werken. Die laatste twee laden pas na je akkoord.{" "}
                  <Link
                    href={businessInfo.legal.cookiePolicyUrl}
                    className="underline underline-offset-2 text-ink hover:text-accent-dark transition-colors"
                  >
                    Lees het cookiebeleid
                  </Link>
                  .
                </p>
              </div>

              {/* Beide knoppen identiek gestyled: weigeren is even makkelijk als accepteren. */}
              <div className="lg:col-span-4 flex flex-col sm:flex-row gap-3 lg:justify-end">
                <Button variant="secondary" size="sm" onClick={() => handleChoice("declined")} className="sm:flex-1 lg:flex-none">
                  Weigeren
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleChoice("accepted")} className="sm:flex-1 lg:flex-none">
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
