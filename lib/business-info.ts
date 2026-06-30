/**
 * Bron van waarheid voor alle bedrijfsgegevens.
 * Wordt gebruikt in: footer, contact-pagina, navbar, ShowroomSection,
 * Organization JSON-LD schema, e-mail templates, juridische pagina's.
 *
 * Wijzig hier — nooit elders hardcoden.
 *
 * Beleid: velden met `null` zijn nog niet door klant bevestigd en
 * worden niet getoond in UI. Footer/templates checken op null.
 */

type PaymentMethod = {
  name: string;
  brandColor: string; // hex met # voor inline-style
};

type OpeningHours = {
  monday: string | null;
  tuesday: string | null;
  wednesday: string | null;
  thursday: string | null;
  friday: string | null;
  saturday: string | null;
  sunday: string | null;
};

export const businessInfo = {
  // Korte handelsnaam (gebruikt in UI, headings, brand)
  name: "Mokka Home",
  // Juridische naam (KvK-geregistreerd, in footer + schema)
  legalName: "Mokka Home Interior BV",
  // Canonieke site-URL — bron van waarheid voor metadataBase, sitemap, JSON-LD
  siteUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://mokkahome.nl",
  // Statement-tagline (footer hero-tekst)
  tagline: "Meubels met een ziel, geselecteerd voor het moderne thuis.",

  address: {
    // Showroom + KvK-adres
    street: "Dynamostraat 5",
    postalCode: "2525 KB",
    city: "Den Haag",
    country: "NL",
    countryName: "Nederland",
  },

  // TODO: bevestig met klant — placeholders nu null zodat templates ze hiden
  kvk: null as string | null,
  btw: null as string | null, // formaat: NL123456789B01

  contact: {
    phone: null as string | null, // TODO: echt nummer
    phoneFormatted: null as string | null, // display-versie bv "070 - 123 45 67"
    email: "hallo@mokkahome.nl",
    supportEmail: null as string | null, // TODO: bevestig of apart support-adres
  },

  foundingYear: 2024,
  foundingCity: "Den Haag",

  // Showroom-openingstijden (display-strings, conditioneel renderen op null)
  openingHours: {
    monday: "10:00–18:00",
    tuesday: "10:00–18:00",
    wednesday: "10:00–18:00",
    thursday: "10:00–18:00",
    friday: "10:00–18:00",
    saturday: "11:00–17:00",
    sunday: null,
  } satisfies OpeningHours,

  // Social URLs — null = niet renderen
  socials: {
    instagram: null as string | null, // TODO: bevestig URL
    facebook: null as string | null,
    pinterest: null as string | null,
    tiktok: null as string | null,
    linkedin: null as string | null,
  },

  // Geaccepteerde betaalmethoden (volgorde = display-volgorde in footer)
  paymentMethods: [
    { name: "iDEAL", brandColor: "#CC0066" },
    { name: "Visa", brandColor: "#1A1F71" },
    { name: "Mastercard", brandColor: "#EB001B" },
    { name: "Bancontact", brandColor: "#000000" },
    { name: "Apple Pay", brandColor: "#000000" },
    { name: "Klarna", brandColor: "#FFA8CD" },
    { name: "PayPal", brandColor: "#003087" },
  ] as ReadonlyArray<PaymentMethod>,

  legal: {
    privacyPolicyUrl: "/privacy",
    termsUrl: "/algemene-voorwaarden",
    cookiePolicyUrl: "/cookies",
  },
} as const;

// ─── Helpers (null-safe) ────────────────────────────────────────────

export function getFullAddress(): string {
  const { street, postalCode, city } = businessInfo.address;
  return `${street}, ${postalCode} ${city}`;
}

export function getMapsUrl(): string {
  const query = encodeURIComponent(getFullAddress());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function getPhoneLink(): string | null {
  const { phone } = businessInfo.contact;
  if (!phone) return null;
  return `tel:${phone.replace(/[\s()-]/g, "")}`;
}

export function getEmailLink(type: "info" | "support" = "info"): string | null {
  const email =
    type === "support"
      ? businessInfo.contact.supportEmail
      : businessInfo.contact.email;
  if (!email) return null;
  return `mailto:${email}`;
}

export function getActiveSocials(): Array<{ platform: string; url: string }> {
  return Object.entries(businessInfo.socials)
    .filter(([, url]) => url !== null)
    .map(([platform, url]) => ({ platform, url: url as string }));
}

/**
 * Compact-formaat openingstijden voor display: groupeert opeenvolgende
 * gelijke dagen ("Ma–Vr 10:00–18:00, Za 11:00–17:00").
 */
export function getOpeningHoursCompact(): string[] {
  const days: Array<{ key: keyof typeof businessInfo.openingHours; label: string }> = [
    { key: "monday", label: "Ma" },
    { key: "tuesday", label: "Di" },
    { key: "wednesday", label: "Wo" },
    { key: "thursday", label: "Do" },
    { key: "friday", label: "Vr" },
    { key: "saturday", label: "Za" },
    { key: "sunday", label: "Zo" },
  ];

  const lines: string[] = [];
  let i = 0;
  while (i < days.length) {
    const hours = businessInfo.openingHours[days[i].key];
    if (!hours) { i++; continue; }
    let j = i;
    while (j + 1 < days.length && businessInfo.openingHours[days[j + 1].key] === hours) j++;
    const label = i === j ? days[i].label : `${days[i].label}–${days[j].label}`;
    lines.push(`${label} ${hours}`);
    i = j + 1;
  }
  return lines;
}
