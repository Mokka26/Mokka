import * as Sentry from "@sentry/nextjs";

/**
 * Centrale foutregistratie (server-only én client-safe). Gebruik dit overal
 * waar een fout bewust niet de flow mag breken (mail, webhook-sync, best-effort
 * writes) — zodat "stil vangen" nooit meer "stil verdwijnen" betekent.
 *
 * - Productie: event naar Sentry met `context` als extra-velden.
 * - Development: ook console.error, zodat je het lokaal direct ziet.
 */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  const error = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
  if (process.env.NODE_ENV === "development") {
    console.error("[captureError]", error, context ?? "");
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Waarschuwing zonder exception (bv. overselling: order betaald maar voorraad
 * stond al op 0). Zelfde kanaal als captureError, level "warning".
 */
export function captureWarning(message: string, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "development") {
    console.warn("[captureWarning]", message, context ?? "");
  }
  Sentry.captureMessage(message, { level: "warning", ...(context ? { extra: context } : {}) });
}
