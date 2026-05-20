/**
 * Bron van waarheid voor verzend-, retour-, betaalbeleid en BTW.
 * Wordt gebruikt in: TrustBar, TopBanner, Footer USP-balk, CartDrawer,
 * cart-pagina, checkout-pagina, ProductDetailClient, FAQ, juridische
 * pagina's, e-mail templates.
 *
 * Wijzig hier — nooit elders hardcoden.
 */

type Usp = {
  key: "shipping" | "return" | "payment" | "advice" | "warranty" | "assembly";
  title: string;
  description: string;
};

export const shippingInfo = {
  // ─── Verzending ───────────────────────────────────────────────
  // Drempel boven welke verzending gratis is (EUR). UI-belofte = €100.
  freeShippingThreshold: 100,
  freeShippingCountries: ["NL", "BE"] as ReadonlyArray<string>,
  freeShippingCopyShort: "Gratis verzending vanaf €100",
  freeShippingCopyLong: "Bij bestellingen boven €100 binnen Nederland en België.",

  // Verzendtarieven onder threshold — TODO: bevestig met klant
  rates: {
    standard: 4.95,    // kleine items
    large: 29.95,      // grote items (banken, kasten)
    xlarge: 49.95,     // extra grote items (eettafels >2m)
  },

  // Levertijden per stock-status — TODO: bevestig per categorie
  deliveryTime: {
    inStock: "2-3 werkdagen",
    backorder: "2-4 weken",
    custom: "6-8 weken",
  },

  // ─── Retour ───────────────────────────────────────────────────
  // 30 dagen = UI-belofte (wettelijk minimum NL = 14).
  returnWindowDays: 30,
  returnCopyShort: "30 dagen retour",
  returnCopyLong: "Niet tevreden? Retour zonder gedoe binnen 30 dagen.",
  returnFree: true,
  returnCondition: "ongebruikt en in originele verpakking",

  // ─── Garantie ─────────────────────────────────────────────────
  warrantyYears: 2,
  warrantyCopyShort: "2 jaar garantie",
  warrantyCopyLong: "Op alle producten — fabrieks- en materiaalfouten.",

  // ─── BTW ──────────────────────────────────────────────────────
  vatRatePercent: 21,
  vatLabelShort: "incl. btw",
  vatLabelLong: "Inclusief 21% BTW",

  // ─── Betaling ─────────────────────────────────────────────────
  paymentCopyShort: "Veilig betalen",
  paymentCopyLong: "iDEAL, creditcard en Klarna — versleutelde verbinding.",

  // ─── USPs voor TrustBar / Footer / PDP ────────────────────────
  // Volgorde = display-volgorde. Selecteer subset via getUspsByKey().
  usps: [
    {
      key: "shipping",
      title: "Gratis verzending",
      description: "Bij bestellingen boven €100 binnen Nederland en België.",
    },
    {
      key: "return",
      title: "30 dagen retour",
      description: "Niet tevreden? Retour zonder gedoe binnen 30 dagen.",
    },
    {
      key: "warranty",
      title: "2 jaar garantie",
      description: "Op alle producten — fabrieks- en materiaalfouten.",
    },
    {
      key: "payment",
      title: "Veilig betalen",
      description: "iDEAL, creditcard en Klarna — versleutelde verbinding.",
    },
    {
      key: "assembly",
      title: "Montageservice",
      description: "Op afspraak mogelijk bij grote stukken.",
    },
    {
      key: "advice",
      title: "Persoonlijk advies",
      description: "Ons atelier staat klaar voor stijlvragen.",
    },
  ] as ReadonlyArray<Usp>,

  // Korte marquee-messages voor TopBanner (max ~40 tekens elk)
  marqueeMessages: [
    "Gratis verzending vanaf €100",
    "30 dagen bedenktijd op elk product",
    "Persoonlijk advies in onze showroom",
    "Nieuwe voorjaarscollectie — nu online",
  ] as ReadonlyArray<string>,

  // Footer USP-balk (4 items, korte sub-tekst)
  footerUsps: [
    { title: "Gratis verzending", sub: "Vanaf €100 in NL" },
    { title: "Montageservice", sub: "Op afspraak mogelijk" },
    { title: "30 dagen retour", sub: "Geen vragen gesteld" },
    { title: "Veilig betalen", sub: "iDEAL, creditcard, Klarna" },
  ] as ReadonlyArray<{ title: string; sub: string }>,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────

export function formatShippingCost(cost: number): string {
  if (cost === 0) return "Gratis";
  return `€ ${cost.toFixed(2).replace(".", ",")}`;
}

export function isEligibleForFreeShipping(
  subtotal: number,
  country = "NL",
): boolean {
  if (!shippingInfo.freeShippingCountries.includes(country)) return false;
  return subtotal >= shippingInfo.freeShippingThreshold;
}

export function getUspsByKey(...keys: Usp["key"][]): Usp[] {
  return shippingInfo.usps.filter((u) => keys.includes(u.key));
}
