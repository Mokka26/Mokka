import { createMollieClient, type MollieClient } from "@mollie/api-client";

// Mollie-client (server-only). Leest MOLLIE_API_KEY (test_… of live_…).
let client: MollieClient | null = null;

export function getMollie(): MollieClient {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) throw new Error("MOLLIE_API_KEY ontbreekt in de omgevingsvariabelen");
  if (!client) client = createMollieClient({ apiKey });
  return client;
}

/** Mollie verwacht bedragen als string met exact 2 decimalen, bv. "799.00". */
export function toMollieAmount(value: number): { currency: "EUR"; value: string } {
  return { currency: "EUR", value: value.toFixed(2) };
}
