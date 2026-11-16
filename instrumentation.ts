import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Env-controle bij het opstarten (na Sentry, zodat een stop ook gelogd
    // wordt). Stopt alleen in productie-runtime bij ontbrekende verplichte
    // variabelen; nooit tijdens de build. Zie lib/env.ts.
    const { checkServerEnv } = await import("./lib/env");
    checkServerEnv();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
