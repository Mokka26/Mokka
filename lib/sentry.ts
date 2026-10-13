import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Centrale foutregistratie voor SERVER-code (route handlers, server actions,
 * crons, lib/*). Gebruik dit overal waar een fout bewust niet de flow mag
 * breken (mail, webhook-sync, best-effort writes) — zodat "stil vangen" nooit
 * meer "stil verdwijnen" betekent.
 *
 * Client components (error.tsx e.d.) importeren lib/sentry-client.ts: die
 * laadt de SDK dynamisch en alleen na cookie-akkoord. De statische import
 * hierboven zou anders de Sentry-core in elke client-bundle trekken;
 * `server-only` bewaakt dat dit bestand nooit in een client component belandt.
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
