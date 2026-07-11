import { createMollieClient, Locale, type MollieClient } from "@mollie/api-client";

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

export type CheckoutMethod = { id: string; description: string; image: string | null };

/**
 * Haalt de betaalmethoden op die daadwerkelijk in het Mollie-account aanstaan
 * en beschikbaar zijn voor dit bedrag/land (bv. Klarna/in3 vallen buiten hun
 * min/max-bedrag weg). Retourneert null bij een fout/ontbrekende API-key, zodat
 * de aanroeper op een vaste lijst kan terugvallen.
 */
export async function listEnabledMethods(
  amountValue: number,
  billingCountry = "NL",
): Promise<CheckoutMethod[] | null> {
  try {
    const methods = await getMollie().methods.list({
      amount: toMollieAmount(amountValue),
      billingCountry,
      includeWallets: "applepay",
      locale: Locale.nl_NL,
    });
    return methods.map((m) => ({
      id: m.id,
      description: m.description,
      image: m.image?.svg ?? null,
    }));
  } catch {
    return null;
  }
}
