"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { businessInfo } from "@/lib/business-info";

const STORAGE_KEY = "mokka_cookie_consent_v1";

type Consent = "accepted" | "declined" | null;

export function getCookieConsent(): Consent {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "accepted" || v === "declined" ? v : null;
}

export default function CookieBanner() {
  // Render strategy: SSR-safe (start hidden), na mount: kijk naar storage
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    if (!consent) setOpen(true);
  }, []);

  const handleChoice = (choice: "accepted" | "declined") => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
      // Trigger custom event zodat tracking-libraries (Sentry etc.) kunnen reageren
      window.dispatchEvent(new CustomEvent("cookieConsentChanged", { detail: choice }));
    } catch {
      // localStorage geblokkeerd (private mode) — banner verbergt sowieso
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Cookie-toestemming"
          aria-describedby="cookie-banner-text"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-[60] bg-white border-t border-line shadow-[0_-12px_40px_-12px_rgba(20,17,13,0.15)]"
        >
          <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 py-6 lg:py-7">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
              <div className="lg:col-span-8">
                <p className="eyebrow mb-2">Cookies</p>
                <p id="cookie-banner-text" className="text-sm text-slate leading-relaxed">
                  We gebruiken functionele cookies voor de werking van de site (winkelwagen, login)
                  en analytische cookies om de webshop te verbeteren. Externe scripts (Cloudinary,
                  Sentry) laden pas na akkoord.{" "}
                  <Link
                    href={businessInfo.legal.cookiePolicyUrl}
                    className="underline hover:text-ink transition-colors"
                  >
                    Meer informatie
                  </Link>
                  .
                </p>
              </div>

              {/* Knoppen — gelijke visuele weight, geen dark patterns (CLAUDE.md sectie 11) */}
              <div className="lg:col-span-4 flex flex-col sm:flex-row gap-3 lg:justify-end">
                <button
                  type="button"
                  onClick={() => handleChoice("declined")}
                  className="px-5 py-3 text-[11px] uppercase tracking-[0.25em] border border-line text-ink hover:border-ink transition-colors"
                >
                  Weigeren
                </button>
                <button
                  type="button"
                  onClick={() => handleChoice("accepted")}
                  className="px-5 py-3 text-[11px] uppercase tracking-[0.25em] bg-ink text-white hover:bg-accent transition-colors"
                >
                  Accepteren
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
