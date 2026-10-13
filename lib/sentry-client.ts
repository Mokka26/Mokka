/**
 * Foutregistratie voor CLIENT components (error.tsx, global-error.tsx, …).
 *
 * Bewust géén statische import van @sentry/nextjs: die zou de Sentry-core
 * (~70 kB gzip) in de root-bundle van elke pagina trekken, terwijl
 * instrumentation-client.ts de SDK pas ná cookie-akkoord laadt. Hier dus:
 *  - zonder akkoord: alleen console (dev) — niets laden, niets versturen;
 *  - met akkoord: dynamische import (zelfde chunk als de al geladen SDK)
 *    en captureException.
 *
 * Server-code gebruikt lib/sentry.ts (statisch, geen bundle-kosten).
 * Zelfde sleutel als components/CookieBanner.tsx en instrumentation-client.ts.
 */
const CONSENT_KEY = "mokka_cookie_consent_v1";

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : JSON.stringify(err));
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  const error = toError(err);
  if (process.env.NODE_ENV === "development") {
    console.error("[captureError]", error, context ?? "");
  }
  if (typeof window === "undefined" || !hasConsent()) return;
  void import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error, context ? { extra: context } : undefined))
    .catch(() => {
      // SDK niet beschikbaar (offline, adblocker): fout mag de foutpagina niet breken.
    });
}
