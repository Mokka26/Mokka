"use client";

import { reopenCookieBanner } from "@/components/CookieBanner";

/** Footer-knop: opent de cookiemelding opnieuw zodat je je keuze kunt wijzigen (AVG: intrekken net zo makkelijk als geven). */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={reopenCookieBanner} className={className}>
      Cookie-instellingen
    </button>
  );
}
