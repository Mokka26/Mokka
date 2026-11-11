// Bewaartermijnen (AVG) — uitgevoerd door de dagelijkse cleanup-cron
// (app/api/cron/cleanup) en beschreven in app/privacy.

/** Contactberichten: na 12 maanden verwijderen (privacyverklaring). */
export const CONTACT_RETENTION_DAYS = 365;
/** Google Ads-klik-ID: na 90 dagen niet meer nodig (conversievenster). */
export const GCLID_RETENTION_DAYS = 90;
/** Fiscale bewaarplicht: 7 jaar ná het boekjaar van de order. */
export const FISCAL_YEARS = 7;

/** Orders vóór deze datum vallen buiten de fiscale bewaarplicht (1 jan, 7 jaar terug). */
export function fiscalCutoff(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear() - FISCAL_YEARS, 0, 1));
}

/** Persoonsgegevens op een order wissen; ordernummer, bedragen en regels blijven (boekhouding). */
export const ANONYMIZED_ORDER = {
  firstName: "—",
  lastName: "—",
  email: "geanonimiseerd@invalid.local",
  phone: "",
  address: "",
  houseNumber: "",
  zipCode: "",
  city: "",
  gclid: null,
  adminNote: null,
  publicToken: null,
} as const;
