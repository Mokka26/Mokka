"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";
import { getCookieConsent } from "@/components/CookieBanner";

// Google Ads-tag (gtag.js). Laadt ALLEEN na cookie-akkoord — de banner en het
// cookiebeleid beloven dat marketingscripts pas na toestemming draaien
// (AVG / Telecommunicatiewet). Zonder NEXT_PUBLIC_GOOGLE_ADS_ID (lokaal,
// preview) rendert dit niets, zodat dev-verkeer nooit in Google Ads belandt.
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const ADS_ID_PATTERN = /^AW-\d+$/;

// Toestemming is externe staat (localStorage + custom event uit CookieBanner):
// useSyncExternalStore leest hem zonder setState-in-effect en is SSR-veilig.
function subscribe(onChange: () => void) {
  window.addEventListener("cookieConsentChanged", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("cookieConsentChanged", onChange);
    window.removeEventListener("storage", onChange);
  };
}
const getSnapshot = () => getCookieConsent() === "accepted";
const getServerSnapshot = () => false;

export function GoogleAdsTag() {
  const consented = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!ADS_ID || !ADS_ID_PATTERN.test(ADS_ID) || !consented) return null;

  // Consent Mode v2: Google eist in de EER een expliciete consent-status.
  // We bereiken dit punt alleen ná akkoord, dus alles staat op 'granted'.
  const bootstrap = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
    gtag('js', new Date());
    gtag('config', ${JSON.stringify(ADS_ID)});
  `;

  return (
    <>
      <Script id="google-ads-bootstrap" strategy="afterInteractive">
        {bootstrap}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ADS_ID)}`}
        strategy="afterInteractive"
      />
    </>
  );
}
