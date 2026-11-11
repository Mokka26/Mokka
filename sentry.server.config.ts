import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  debug: false,
  // Geen persoonsgegevens naar Sentry (AVG): geen IP/cookies/headers standaard,
  // en wat er via context toch in komt (e-mail, adres) wordt eruit gehaald.
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.user) event.user = { id: event.user.id };
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.data;
    }
    for (const ctx of Object.values(event.contexts ?? {})) {
      if (ctx && typeof ctx === "object") {
        for (const key of ["email", "phone", "address", "firstName", "lastName", "zipCode"]) {
          delete (ctx as Record<string, unknown>)[key];
        }
      }
    }
    return event;
  },
});
