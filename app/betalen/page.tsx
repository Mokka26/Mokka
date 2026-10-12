import type { Metadata } from "next";
import Link from "next/link";
import { ContentCta, ContentPage, ContentSection, contentLinkClass } from "@/components/content/ContentPage";
import { PaymentIconRow } from "@/components/PaymentIcons";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { NEXT_STEP_AFTER_PAYMENT } from "@/lib/email";
import { shippingInfo } from "@/lib/shipping-info";
import type { BreadcrumbItem } from "@/lib/jsonLd";

const PATH = "/betalen";
const TITLE = "Veilig betalen: iDEAL, creditcard en Klarna";
const DESCRIPTION = `Betaal bij ${businessInfo.name} met iDEAL, creditcard, Bancontact, Apple Pay, Klarna of PayPal via een versleutelde verbinding. Alle prijzen incl. ${shippingInfo.vatRatePercent}% btw.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    title: `${TITLE} | ${businessInfo.name}`,
    description: DESCRIPTION,
    type: "website",
    url: PATH,
    locale: "nl_NL",
  },
};

const breadcrumbs: BreadcrumbItem[] = [
  { name: "Home", url: "/" },
  { name: "Veilig betalen", url: PATH },
];

// Korte uitleg per betaalmethode uit lib/business-info.ts. Methoden zonder
// uitleg krijgen alleen hun naam; nieuwe methoden hoef je hier dus niet
// verplicht toe te voegen.
const METHOD_NOTES: Record<string, string> = {
  ideal: "Betaal direct vanuit je eigen bank. Je rekent af in de app of omgeving van je bank en komt daarna terug op onze site.",
  visa: "Creditcard; het bedrag wordt via een beveiligde betaalpagina afgeschreven.",
  mastercard: "Creditcard; het bedrag wordt via een beveiligde betaalpagina afgeschreven.",
  bancontact: "De gangbare bankbetaling voor klanten in België.",
  applepay: "Betaal met de kaart in je Apple Wallet op een iPhone, iPad of Mac.",
  klarna: "Achteraf betalen of in delen, volgens de voorwaarden van Klarna. Klarna beoordeelt zelf of je ervoor in aanmerking komt.",
  paypal: "Betaal vanuit je PayPal-saldo of een gekoppelde kaart of rekening.",
};

function methodKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export default function BetalenPage() {
  const phoneLink = getPhoneLink();
  const phone = businessInfo.contact.phoneFormatted;
  const methods = businessInfo.paymentMethods;
  const methodNames = methods.map((m) => m.name);
  const methodList =
    methodNames.length > 1 ? `${methodNames.slice(0, -1).join(", ")} en ${methodNames[methodNames.length - 1]}` : methodNames[0] ?? "";

  const faq = [
    {
      q: "Is betalen bij jullie veilig?",
      a: "Ja. De betaling verloopt via Mollie, een Nederlandse betaaldienstverlener met een vergunning van De Nederlandsche Bank. Je betaalgegevens gaan rechtstreeks naar je bank of kaartmaatschappij over een versleutelde verbinding; wij slaan geen kaart- of rekeningnummers op.",
    },
    {
      q: "Moet ik een account aanmaken om te bestellen?",
      a: "Nee. Je kunt altijd als gast afrekenen. We vragen alleen de gegevens die nodig zijn om je bestelling te bezorgen en je op de hoogte te houden.",
    },
    {
      q: "Zijn de prijzen inclusief btw?",
      a: `Ja. Alle prijzen op de site zijn inclusief ${shippingInfo.vatRatePercent}% btw. Verzendkosten zie je in de winkelwagen, vóór je afrekent; vanaf €${shippingInfo.freeShippingThreshold} is bezorging gratis.`,
    },
    {
      q: "Kan ik achteraf of in delen betalen?",
      a: "Met Klarna kun je achteraf of in delen betalen. Klarna beoordeelt zelf of je ervoor in aanmerking komt en hanteert eigen voorwaarden; die zie je tijdens het afrekenen.",
    },
    {
      q: "Wat gebeurt er na mijn betaling?",
      a: `Je krijgt direct een orderbevestiging per e-mail met je bestelnummer. ${NEXT_STEP_AFTER_PAYMENT}`,
    },
    {
      q: "Mijn betaling is mislukt of ik ben niet teruggekeerd op de site. Wat nu?",
      a: "Controleer eerst of je een orderbevestiging hebt ontvangen. Zo niet, dan is er niets afgeschreven en kun je het opnieuw proberen. Twijfel je, neem dan contact met ons op met de datum en het bedrag; we zoeken het voor je uit.",
    },
  ];

  return (
    <ContentPage
      eyebrow="Service"
      title="Veilig betalen"
      intro={`Je betaalt bij ${businessInfo.name} met ${methodList}, via een versleutelde verbinding. Alle prijzen zijn inclusief btw en je hoeft geen account aan te maken.`}
      breadcrumbs={breadcrumbs}
      faq={faq}
      footer={
        <ContentCta
          heading="Liever eerst overleggen?"
          text={
            <>
              Bestellen kan ook in de showroom in {businessInfo.address.city}, of bel ons
              {phoneLink && phone && (
                <>
                  {" "}
                  op{" "}
                  <a href={phoneLink} className={contentLinkClass} aria-label={`Bel ons: ${phone}`}>
                    {phone}
                  </a>
                </>
              )}
              . We leggen graag uit hoe het afrekenen werkt.
            </>
          }
          primary={{ href: "/products", label: "Bekijk de collectie" }}
          secondary={{ href: "/contact", label: "Neem contact op" }}
        />
      }
    >
      <ContentSection heading="Betaalmethoden">
        <p>Je kiest tijdens het afrekenen zelf hoe je betaalt. Dit zijn de mogelijkheden:</p>
        <div className="py-2">
          <PaymentIconRow tone="dark" compact={false} />
        </div>
        <ul>
          {methods.map((m) => {
            const note = METHOD_NOTES[methodKey(m.name)];
            return (
              <li key={m.name}>
                <strong>{m.name}</strong>
                {note ? `: ${note}` : ""}
              </li>
            );
          })}
        </ul>
      </ContentSection>

      <ContentSection heading="Via Mollie, over een versleutelde verbinding">
        <p>
          De betaling verloopt via Mollie, een Nederlandse betaaldienstverlener met een vergunning van De Nederlandsche Bank. Je rekent af op een beveiligde betaalpagina van je bank, kaartmaatschappij of Klarna; je kaart- of rekeninggegevens komen niet bij ons terecht en slaan we dus ook niet op.
        </p>
        <p>
          De verbinding met onze site is versleuteld (https). Zie je een slotje in de adresbalk, dan kun je veilig doorgaan.
        </p>
      </ContentSection>

      <ContentSection heading="Prijzen inclusief btw">
        <p>
          Alle prijzen op de site zijn inclusief {shippingInfo.vatRatePercent}% btw; het bedrag bij een product is het bedrag dat je betaalt. Verzendkosten zie je in de winkelwagen, vóór je afrekent. Hoe dat zit, lees je op de pagina{" "}
          <Link href="/bezorging" className={contentLinkClass}>
            bezorging en montage
          </Link>
          .
        </p>
        <p>Onze btw- en KvK-gegevens staan onderaan elke pagina.</p>
      </ContentSection>

      <ContentSection heading="Afrekenen zonder account">
        <p>
          Je rekent altijd als gast af. We vragen alleen wat nodig is om je bestelling te bezorgen: je naam, adres, e-mailadres en telefoonnummer, zodat we je kunnen bellen voor de bezorgafspraak. Hoe we met je gegevens omgaan, staat in ons{" "}
          <Link href={businessInfo.legal.privacyPolicyUrl} className={contentLinkClass}>
            privacybeleid
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="Wat er na je betaling gebeurt">
        <ol>
          <li>Je ontvangt direct een orderbevestiging per e-mail, met je bestelnummer en een overzicht van je bestelling.</li>
          <li>{NEXT_STEP_AFTER_PAYMENT}</li>
          <li>Op de afgesproken dag bezorgen we je bestelling. Je hebt daarna {shippingInfo.returnWindowDays} dagen bedenktijd, mits het product {shippingInfo.returnCondition} is.</li>
        </ol>
        <p>
          Geen bevestiging ontvangen? Kijk in je spam-map en neem anders contact met ons op. Zonder bevestiging is er geen betaling verwerkt.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
