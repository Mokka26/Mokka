import { businessInfo, getFullAddress } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";

/**
 * Algemene voorwaarden — één bron voor de pagina /algemene-voorwaarden en de
 * tekstbijlage bij de orderbevestiging (duurzame drager, art. 6:230v BW).
 * Art. 6 en 7 komen uit lib/shipping-info.ts; wijzig ze daar.
 *
 * Juridisch toetsen door de eigenaar vóór de live-gang.
 */

/** Bijwerken bij elke inhoudelijke wijziging (staat ook in de mailbijlage). */
export const TERMS_VERSION = "november 2026";

export const TERMS_TITLE = "Algemene voorwaarden";
export const TERMS_INTRO = `Deze voorwaarden zijn van toepassing op elke bestelling die je bij ${businessInfo.name} plaatst.`;

export type TermsParagraph = {
  text: string;
  /** Interne link aan het eind van de alinea (pagina: <Link>, tekst: volledige URL). */
  link?: { href: string; label: string };
};

export type TermsSection = { heading: string; paragraphs: TermsParagraph[] };

export function termsSections(): TermsSection[] {
  const days = shippingInfo.returnWindowDays;
  const { customMade } = shippingInfo;
  const email = businessInfo.contact.email;
  const ids = [
    businessInfo.kvk ? `KvK-nummer: ${businessInfo.kvk}.` : "",
    businessInfo.btw ? `Btw-nummer: ${businessInfo.btw}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    {
      heading: "1. Identiteit van de onderneming",
      paragraphs: [
        { text: `${businessInfo.legalName}, gevestigd aan ${getFullAddress()}.${ids ? ` ${ids}` : ""} Bereikbaar via ${email}.` },
      ],
    },
    {
      heading: "2. Toepasselijkheid",
      paragraphs: [
        {
          text: `Deze voorwaarden gelden voor elk aanbod en elke overeenkomst tussen ${businessInfo.name} en de klant. Door een bestelling te plaatsen ga je akkoord met deze voorwaarden.`,
        },
      ],
    },
    {
      heading: "3. Prijzen en aanbod",
      paragraphs: [
        {
          text: "Alle prijzen zijn in euro's en inclusief btw. Kennelijke vergissingen of fouten in het aanbod binden ons niet. Verzendkosten en levertijd worden vóór het afronden van de bestelling getoond.",
        },
      ],
    },
    {
      heading: "4. Betaling",
      paragraphs: [
        {
          text: "Betaling verloopt via de op de website aangeboden betaalmethoden. De bestelling wordt verwerkt nadat de betaling is bevestigd.",
        },
      ],
    },
    {
      heading: "5. Levering en uitvoering",
      paragraphs: [
        {
          text: "We leveren binnen de bij de bestelling aangegeven levertijd. Lukt dit onverhoopt niet, dan informeren we je tijdig en heb je het recht de overeenkomst kosteloos te ontbinden.",
        },
      ],
    },
    {
      heading: "6. Herroepingsrecht",
      paragraphs: [
        {
          text: `Je hebt ${days} dagen bedenktijd om de overeenkomst zonder opgave van reden te ontbinden. De bedenktijd gaat in na ontvangst van het product (bij meerdere leveringen: het laatste product). Meld je herroeping binnen die termijn per e-mail aan ${email} of met het modelformulier; daarna heb je nog ${days} dagen om het product terug te sturen of naar de showroom te brengen.`,
        },
        { text: shippingInfo.returnInspectionCopy },
        {
          text: `${shippingInfo.returnFeesCopy} We betalen het aankoopbedrag terug, inclusief de standaard verzendkosten van de heenzending. ${shippingInfo.refundCopy}`,
        },
        {
          text: `Uitgezonderd is alleen ${customMade.label.toLowerCase()}: ${customMade.definition}. ${customMade.returnNote} Producten in een standaarduitvoering die we voor je bij de fabrikant bestellen, vallen gewoon onder de bedenktijd.`,
        },
        {
          text: "De procedure, het retouradres en het modelformulier vind je op de pagina",
          link: { href: businessInfo.legal.returnPolicyUrl, label: "Retourneren" },
        },
      ],
    },
    {
      heading: "7. Conformiteit en garantie",
      paragraphs: [
        {
          text: "Onze producten voldoen aan de overeenkomst en aan de wettelijke eisen. Je hebt de wettelijke garantie: een product moet doen wat je er redelijkerwijs van mag verwachten.",
        },
        {
          text: `Daarnaast geven we garantie op fabrieks- en materiaalfouten; de duur staat bij het product. ${shippingInfo.legalRightsCopy}`,
        },
      ],
    },
    {
      heading: "8. Klachten",
      paragraphs: [
        {
          text: `Heb je een klacht? Neem contact op via ${email}. We reageren binnen 14 dagen. Komen we er samen niet uit, dan kun je het geschil voorleggen aan de bevoegde rechter.`,
        },
      ],
    },
  ];
}

/** Platte tekst (UTF-8) voor de mailbijlage; links als volledige URL. */
export function termsPlainText(): string {
  const site = businessInfo.siteUrl.replace(/\/$/, "");
  const body = termsSections()
    .map((s) =>
      [
        s.heading,
        ...s.paragraphs.map((p) => (p.link ? `${p.text} ${p.link.label} (${site}${p.link.href}).` : p.text)),
      ].join("\n\n"),
    )
    .join("\n\n\n");
  return [
    `${TERMS_TITLE} — ${businessInfo.legalName}`,
    `Versie ${TERMS_VERSION} · ${site}${businessInfo.legal.termsUrl}`,
    "",
    TERMS_INTRO,
    "",
    "",
    body,
    "",
  ].join("\n");
}
