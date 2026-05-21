import * as Sentry from "@sentry/nextjs";

const CONSENT_KEY = "mokka_cookie_consent_v1";

function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  debug: false,
  // AVG/ePrivacy: events alleen verzenden bij geaccepteerde cookies.
  // Server-side errors blijven actief (legitiem belang, geen PII).
  beforeSend(event) {
    return hasConsent() ? event : null;
  },
  beforeSendTransaction(event) {
    return hasConsent() ? event : null;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
