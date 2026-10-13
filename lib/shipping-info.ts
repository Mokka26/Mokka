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

  // Verzendbeleid (bevestigd door klant, 2026-07): één vlak tarief onder de
  // gratis-verzendgrens; boven €100 altijd gratis — óók grote meubels. Geen
  // aparte toeslag per formaat.
  rates: {
    standard: 4.95,
  },

  // Levertijden per stock-status — TODO: bevestig per categorie
  deliveryTime: {
    inStock: "2-3 werkdagen",
    backorder: "2-4 weken",
    custom: "6-8 weken",
  },

  // Concrete vervolgstap na betaling — één bron, gebruikt in de orderbevestiging
  // (lib/email.ts), de bedankpagina en de pagina's bezorging en betalen.
  nextStepAfterPayment: "We bellen of mailen je binnen 2 werkdagen om de bezorging in te plannen.",

  // ─── Maatwerk ─────────────────────────────────────────────────
  // Eén definitie voor bezorging, retourneren en de productpagina. "Op
  // bestelling" (standaarduitvoering, besteld bij de fabrikant) is GÉÉN
  // maatwerk en valt gewoon onder de bedenktijd.
  customMade: {
    label: "Maatwerk",
    definition: "speciaal voor jou gemaakt, bijvoorbeeld in een door jou gekozen stof, kleur of maat",
    // Juridisch toetsen door de eigenaar: art. 6:230p BW (uitzonderingen herroepingsrecht).
    returnNote:
      "Maatwerk is wettelijk uitgesloten van het herroepingsrecht. Dat staat bij het product vermeld vóórdat je bestelt.",
  },

  // ─── Garantie ─────────────────────────────────────────────────
  // Default-garantie in jaren; per categorie te overschrijven (zie
  // warrantyByCategory + warrantyYearsFor()).
  // Standaard 1 jaar; bedden 2 jaar; slaapkamers geen garantie (0 = niet tonen).
  warrantyYears: 1,
  warrantyByCategory: {
    bedden: 2,
    slaapkamers: 0,
  } as Record<string, number>,
  warrantyCopyShort: "Garantie",
  warrantyCopyLong: "Op fabrieks- en materiaalfouten.",

  // ─── Retour ───────────────────────────────────────────────────
  // Wettelijk herroepingsrecht (art. 6:230o BW): 14 dagen bedenktijd, de klant
  // mag het product uitpakken en beoordelen zoals in een winkel. Alleen bij
  // gebruik of beschadiging die verder gaat dan beoordelen mag waardevermindering
  // worden verrekend. "Alleen ongeopende verpakking" is in Nederland niet
  // houdbaar en staat hier daarom niet meer.
  // Juridisch toetsen door de eigenaar: de teksten hieronder zijn een
  // voorstel; laat ze nakijken vóór de live-gang.
  returnWindowDays: 14,
  returnCopyShort: "14 dagen retour",
  returnCopyLong: "14 dagen bedenktijd. Retourkosten voor eigen rekening, maatwerk uitgezonderd.",
  /** Past in "mits het product <returnCondition>". */
  returnCondition: "compleet is en niet verder gebruikt dan nodig om het te beoordelen",
  returnInspectionCopy:
    "Je mag het product uitpakken, bekijken en beoordelen zoals je dat in een winkel zou doen. Is het daarna gebruikt of beschadigd, dan kunnen we de waardevermindering verrekenen met het bedrag dat je terugkrijgt.",
  /** Wie de kosten van de retourzending draagt (schema.org MerchantReturnPolicy.returnFees). */
  returnFeesPaidBy: "customer" as "customer" | "merchant",
  returnFeesCopy: "De kosten voor het terugsturen zijn voor jouw rekening; terugbrengen naar de showroom is gratis.",
  /** Landen waarvoor het retourbeleid geldt (los van de gratis-verzendlanden). */
  returnCountries: ["NL", "BE"] as ReadonlyArray<string>,
  /** Hoe snel een retouraanmelding wordt bevestigd; bewust zonder harde termijn. */
  returnConfirmationCopy: "Je ontvangt zo snel mogelijk een bevestiging met instructies.",

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
      title: "14 dagen retour",
      description: "Wettelijke bedenktijd; retourkosten voor eigen rekening, maatwerk uitgezonderd.",
    },
    {
      key: "warranty",
      title: "Garantie",
      description: "Op fabrieks- en materiaalfouten.",
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
      description: "Bel of mail ons voor advies over maten, stoffen en kleuren.",
    },
  ] as ReadonlyArray<Usp>,

  // Korte marquee-messages voor TopBanner (max ~40 tekens elk)
  marqueeMessages: [
    "Gratis verzending vanaf €100",
    "14 dagen wettelijke bedenktijd",
    "Persoonlijk advies in onze showroom",
    "Kom proefzitten in onze showroom",
  ] as ReadonlyArray<string>,

  // Footer USP-balk (4 items, korte sub-tekst)
  footerUsps: [
    { title: "Gratis verzending", sub: "Vanaf €100 in NL" },
    { title: "14 dagen retour", sub: "Wettelijke bedenktijd" },
    { title: "Garantie", sub: "Op fabrieks- en materiaalfouten" },
    { title: "Veilig betalen", sub: "iDEAL, creditcard, Klarna" },
  ] as ReadonlyArray<{ title: string; sub: string }>,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────

/** Vervolgstap na betaling; alias van `shippingInfo.nextStepAfterPayment`. */
export const NEXT_STEP_AFTER_PAYMENT = shippingInfo.nextStepAfterPayment;

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

/** Garantie in jaren voor een categorie (banken 1, rest default). */
export function warrantyYearsFor(category: string): number {
  return shippingInfo.warrantyByCategory[category] ?? shippingInfo.warrantyYears;
}
