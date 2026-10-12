// Client-side Sentry. Twee afspraken:
//  1. Niets laden of versturen vóór cookie-akkoord (AVG/ePrivacy; de
//     cookiebanner belooft dat). De SDK wordt pas dynamisch geïmporteerd na
//     "accepted" — vóór die tijd zit er geen Sentry-code in de bundle.
//  2. Alleen fouten: geen browser-tracing (transacties werden toch
//     weggegooid), geen session replay. Dat scheelt ~25 kB gzip aan code én
//     alle performance-spans/requests naar Sentry.
//
// Zelfde sleutel + event als components/CookieBanner.tsx en GoogleAdsTag.tsx.
const CONSENT_KEY = "mokka_cookie_consent_v1";
const CONSENT_EVENT = "cookieConsentChanged";

let initialised = false;

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

async function initSentry(): Promise<void> {
  if (initialised) return;
  initialised = true;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    debug: false,
    sendDefaultPii: false,
    // Geen tracing: geen tracesSampleRate/tracesSampler, en de default
    // BrowserTracing-integratie expliciet eruit.
    integrations: (defaults) =>
      defaults.filter((i) => i.name !== "BrowserTracing" && i.name !== "Replay"),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Vangnet: trekt iemand de toestemming later in, dan stopt verzenden.
    beforeSend(event) {
      return hasConsent() ? event : null;
    },
  });
}

if (typeof window !== "undefined") {
  if (hasConsent()) {
    void initSentry();
  } else {
    window.addEventListener(CONSENT_EVENT, (e: Event) => {
      if ((e as CustomEvent<unknown>).detail === "accepted") void initSentry();
    });
  }
}
