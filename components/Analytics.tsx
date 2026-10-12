"use client";

import Script from "next/script";
import { ADS_ID, ADS_ID_PATTERN, GA4_ID, GA4_ID_PATTERN } from "@/lib/analytics";

// Google-tag (gtag.js) voor GA4 én Google Ads, met Consent Mode v2 in de
// "advanced" opstelling:
//
// 1. Een inline script (uitgevoerd tijdens het parsen van de HTML, dus vóór
//    gtag.js) zet de consent-default op 'denied' voor alle vier de signalen,
//    en upgradet direct naar 'granted' als de bezoeker eerder al "Accepteren"
//    koos (localStorage-sleutel van components/CookieBanner.tsx). Daardoor
//    hoeft Google niet op `wait_for_update` te wachten bij terugkerend bezoek.
// 2. gtag.js laadt daarna (afterInteractive). Zonder akkoord zet het geen
//    cookies en stuurt het alleen cookieloze pings (gemodelleerde conversies).
// 3. Bij een keuze in de banner roept CookieBanner `applyConsent()` aan
//    (lib/analytics.ts) → `gtag('consent','update', …)`.
//
// Zonder NEXT_PUBLIC_GA4_ID én zonder NEXT_PUBLIC_GOOGLE_ADS_ID (lokaal,
// preview) rendert dit niets, zodat dev-verkeer nooit in rapportages belandt.
//
// Het localStorage-sleutelwoord staat hier bewust letterlijk: dit script moet
// zonder bundel-afhankelijkheden draaien. Houd het gelijk aan CookieBanner.tsx.
const CONSENT_STORAGE_KEY = "mokka_cookie_consent_v1";

const ga4 = GA4_ID && GA4_ID_PATTERN.test(GA4_ID) ? GA4_ID : null;
const ads = ADS_ID && ADS_ID_PATTERN.test(ADS_ID) ? ADS_ID : null;

function buildBootstrap(): string {
  const configs = [
    ga4 ? `gtag('config', ${JSON.stringify(ga4)});` : "",
    // allow_enhanced_conversions: Enhanced Conversions (web) via gtag('set','user_data').
    ads ? `gtag('config', ${JSON.stringify(ads)}, { allow_enhanced_conversions: true });` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
try {
  if (window.localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)}) === 'accepted') {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
  }
} catch (e) {}
gtag('js', new Date());
${configs}
`;
}

export function Analytics() {
  if (!ga4 && !ads) return null;

  const primaryId = ga4 ?? ads!;

  return (
    <>
      {/* Gewone <script> (geen next/script): wordt synchroon uitgevoerd bij het
          parsen, dus gegarandeerd vóór gtag.js — vereist voor Consent Mode. */}
      <script id="google-tag-bootstrap" dangerouslySetInnerHTML={{ __html: buildBootstrap() }} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryId)}`}
        strategy="afterInteractive"
      />
    </>
  );
}
