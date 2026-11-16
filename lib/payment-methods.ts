import { businessInfo } from "@/lib/business-info";

/** Betaalmethode zoals de site hem toont (id = Mollie-methode-id). */
export type PaymentMethodView = { id: string; description: string; image: string | null };

/**
 * Officiële kleuriconen van de betaalmethoden, zelf gehost in
 * /public/payment/color/ (bron: Mollie /v2/methods). Zo laadt geen enkele
 * pagina iets van mollie.com en ziet elke plek (footer, koopblok, winkelwagen,
 * checkout, /betalen) dezelfde logo's. Nieuwe methode in Mollie? Zet het SVG
 * erbij en voeg het id hier toe; tot dan toont de site alleen de naam.
 */
const LOCAL_ICONS = new Set(["applepay", "bancontact", "creditcard", "ideal", "in3", "klarna", "paypal"]);

export function localPaymentIcon(id: string): string | null {
  return LOCAL_ICONS.has(id) ? `/payment/color/${id}.svg` : null;
}

// Naam uit lib/business-info → Mollie-id. Visa en Mastercard vallen samen
// onder "creditcard", zoals Mollie ze ook als één methode aanbiedt.
const NAME_TO_ID: Record<string, { id: string; description: string }> = {
  ideal: { id: "ideal", description: "iDEAL" },
  visa: { id: "creditcard", description: "Creditcard" },
  mastercard: { id: "creditcard", description: "Creditcard" },
  bancontact: { id: "bancontact", description: "Bancontact" },
  applepay: { id: "applepay", description: "Apple Pay" },
  klarna: { id: "klarna", description: "Klarna" },
  paypal: { id: "paypal", description: "PayPal" },
  in3: { id: "in3", description: "in3" },
};

/** Vaste lijst uit lib/business-info, voor als Mollie (tijdelijk) niet antwoordt. */
export function fallbackPaymentMethods(): PaymentMethodView[] {
  const seen = new Set<string>();
  const out: PaymentMethodView[] = [];
  for (const m of businessInfo.paymentMethods) {
    const key = m.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const mapped = NAME_TO_ID[key] ?? { id: key, description: m.name };
    if (seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    out.push({ ...mapped, image: localPaymentIcon(mapped.id) });
  }
  return out;
}

/** "iDEAL, Creditcard en Klarna" voor lopende tekst. */
export function paymentMethodSentence(methods: ReadonlyArray<PaymentMethodView>): string {
  const names = methods.map((m) => m.description);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
}
