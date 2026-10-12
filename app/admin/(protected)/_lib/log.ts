import { captureError } from "@/lib/sentry";

/**
 * Foutlogging voor admin-acties: geen `console.error` (CLAUDE.md §6), alles
 * via de centrale `captureError` met een `context`-tag zodat het in Sentry
 * terug te vinden is.
 */
export function logAdminError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  captureError(error, { area: "admin", context, ...extra });
}
