import type { Metadata } from "next";
import Link from "next/link";
import { ContentCta, ContentPage, ContentSection, ContentTable, contentLinkClass } from "@/components/content/ContentPage";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { NEXT_STEP_AFTER_PAYMENT, formatShippingCost, getUspsByKey, shippingInfo } from "@/lib/shipping-info";
import type { BreadcrumbItem } from "@/lib/jsonLd";
import { ogDefaults } from "@/lib/seo";

const PATH = "/bezorging";
const TITLE = "Bezorging en montage: levertijd en kosten";
const DESCRIPTION = `Wat op voorraad is leveren we binnen ${shippingInfo.deliveryTime.inStock}. Verzendkosten ${formatShippingCost(shippingInfo.rates.standard)}, gratis vanaf €${shippingInfo.freeShippingThreshold} in Nederland en België. Bezorging en montage op afspraak.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  ...ogDefaults({ title: `${TITLE} | ${businessInfo.name}`, description: DESCRIPTION, url: PATH }),
};

const breadcrumbs: BreadcrumbItem[] = [
  { name: "Home", url: "/" },
  { name: "Bezorging en montage", url: PATH },
];

const COUNTRY_NAMES: Record<string, string> = { NL: "Nederland", BE: "België" };

function countryList(): string {
  const names = shippingInfo.freeShippingCountries.map((c) => COUNTRY_NAMES[c] ?? c);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
}

export default function BezorgingPage() {
  const { deliveryTime, freeShippingThreshold, rates, customMade } = shippingInfo;
  const standardCost = formatShippingCost(rates.standard);
  const countries = countryList();
  const deliversToBelgium = shippingInfo.freeShippingCountries.includes("BE");
  const assemblyUsp = getUspsByKey("assembly")[0];
  const phoneLink = getPhoneLink();
  const phone = businessInfo.contact.phoneFormatted;

  const faq = [
    {
      q: "Hoe snel heb ik mijn bestelling in huis?",
      a: `Producten die op voorraad zijn leveren we binnen ${deliveryTime.inStock}. Producten op bestelling duren ${deliveryTime.backorder}, maatwerk (${customMade.definition}) ${deliveryTime.custom}. De levertijd staat altijd bij het product, vóórdat je afrekent.`,
    },
    {
      q: "Wat kost bezorging?",
      a: `Onder €${freeShippingThreshold} betaal je ${standardCost} verzendkosten. Vanaf €${freeShippingThreshold} bezorgen we gratis in ${countries}, ook grote meubels zoals banken en bedden. Er is geen aparte toeslag per formaat.`,
    },
    {
      q: "Hoe wordt de bezorging ingepland?",
      a: `${NEXT_STEP_AFTER_PAYMENT} Je hoort dan een dag en een tijdvak, zodat je weet wanneer je thuis moet zijn.`,
    },
    {
      q: "Zetten jullie het meubel ook in elkaar?",
      a: `Montage is op afspraak mogelijk bij grote stukken. Geef bij je bestelling of in het telefoongesprek aan dat je montage wilt; we vertellen dan wat de mogelijkheden en eventuele kosten zijn.`,
    },
    {
      q: "Wat moet ik thuis voorbereiden?",
      a: "Meet vooraf de voordeur, de gang, de trap en eventuele bochten, en zet de plek waar het meubel komt vrij. Grote banken en bedden worden in losse delen geleverd; de maten per deel staan bij de specificaties van het product.",
    },
    {
      q: "Kan ik mijn bestelling ook afhalen in de showroom?",
      a: `Vraag naar de mogelijkheden als we je bellen om de bezorging in te plannen; afhalen in de showroom in ${businessInfo.address.city} is op afspraak soms mogelijk.`,
    },
  ];

  return (
    <ContentPage
      eyebrow="Service"
      title="Bezorging en montage"
      intro={`Je ziet de levertijd en de verzendkosten bij elk product en in de winkelwagen, vóór je afrekent. Hieronder lees je wat je kunt verwachten: van de levertijd per voorraadstatus tot de afspraak voor bezorging en montage.`}
      breadcrumbs={breadcrumbs}
      faq={faq}
      footer={
        <ContentCta
          heading="Vragen over je bezorging?"
          text={
            <>
              Bel ons
              {phoneLink && phone && (
                <>
                  {" "}
                  op{" "}
                  <a href={phoneLink} className={contentLinkClass} aria-label={`Bel ons: ${phone}`}>
                    {phone}
                  </a>
                </>
              )}{" "}
              of stuur een bericht via de contactpagina. We helpen je graag met maten, levertijd en het inplannen van een moment.
            </>
          }
          primary={{ href: "/contact", label: "Neem contact op" }}
          secondary={{ href: "/banken", label: "Bekijk de banken" }}
        />
      }
    >
      <ContentSection heading="Levertijd per voorraadstatus">
        <p>
          De levertijd hangt af van de voorraadstatus van het product. Die status zie je op elke productkaart en productpagina, dus je weet vóór je bestelt waar je aan toe bent.
        </p>
        <ContentTable
          caption="Levertijd per voorraadstatus, gerekend vanaf de betaling."
          head={["Status", "Levertijd", "Wat het betekent"]}
          rows={[
            ["Op voorraad", deliveryTime.inStock, "Het product is direct leverbaar."],
            ["Op bestelling", deliveryTime.backorder, "Het product wordt in standaarduitvoering voor je besteld. Dit is geen maatwerk."],
            [customMade.label, deliveryTime.custom, `Het product wordt ${customMade.definition}.`],
          ]}
        />
        <p>
          Staat er bij een product een afwijkende levertijd, dan geldt die. Verandert er iets aan de verwachte leverdatum, dan houden we je op de hoogte.
        </p>
      </ContentSection>

      <ContentSection heading="Verzendkosten">
        <ul>
          <li>
            <strong>Onder €{freeShippingThreshold}:</strong> {standardCost} verzendkosten, één vast tarief.
          </li>
          <li>
            <strong>Vanaf €{freeShippingThreshold}:</strong> gratis bezorging in {countries}, ook voor grote meubels. Er is geen toeslag per formaat.
          </li>
        </ul>
        <p>
          Het bedrag dat je in de winkelwagen ziet, is het bedrag dat je betaalt. Alle prijzen zijn inclusief {shippingInfo.vatRatePercent}% btw.
        </p>
      </ContentSection>

      {deliversToBelgium && (
        <ContentSection heading="Bezorging in België">
          <p>
            We bezorgen ook in België. Daar gelden dezelfde verzendkosten en dezelfde gratis-verzendgrens van €{freeShippingThreshold} als in Nederland, en we plannen de bezorging net zo in overleg met je in.
          </p>
        </ContentSection>
      )}

      <ContentSection heading="Zo werkt de afspraak">
        <ol>
          <li>Je bestelt online of in de showroom en betaalt. Je krijgt direct een bevestiging per e-mail.</li>
          <li>{NEXT_STEP_AFTER_PAYMENT}</li>
          <li>We spreken een dag en een tijdvak af dat jou uitkomt, en bespreken of montage gewenst is.</li>
          <li>Op de bezorgdag leveren we het meubel af op het afgesproken adres. Controleer de levering bij ontvangst en meld eventuele schade meteen.</li>
        </ol>
      </ContentSection>

      <ContentSection heading="Montage">
        <p>
          {assemblyUsp ? `${assemblyUsp.title}: ${assemblyUsp.description.toLowerCase()}` : "Montage is op afspraak mogelijk."}{" "}
          Denk aan boxsprings, kledingkasten en hoekbanken die in losse delen geleverd worden. Geef het aan bij je bestelling of in het telefoongesprek, dan hoor je wat de mogelijkheden zijn en wat het eventueel kost.
        </p>
        <p>
          Wil je zelf monteren? Zorg dat je met twee personen bent en bewaar de verpakking tot je zeker weet dat je het product houdt: dan kun je het bij een retour weer goed inpakken. Lees daarover meer op de pagina{" "}
          <Link href={businessInfo.legal.returnPolicyUrl} className={contentLinkClass}>
            retourneren
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="Meet vooraf of het past">
        <p>
          Teleurstelling op de bezorgdag voorkom je met een meetlint. Meet de breedte van je voordeur, de gang, de trap en bochten, en de plek waar het meubel komt. Een standaard deur is 83 cm breed; losse bankdelen zijn meestal 90 tot 100 cm diep en passen daar met kantelen doorheen. De maten per deel staan bij de specificaties van het product.
        </p>
        <p>
          Twijfel je? Stuur ons de maten van je ruimte via de contactpagina of kom langs in de showroom in {businessInfo.address.city}. We rekenen het met je uit. Praktische vuistregels vind je ook in onze{" "}
          <Link href="/gids" className={contentLinkClass}>
            woongidsen
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="Garantie en voorwaarden">
        <p>
          Op fabrieks- en materiaalfouten geldt garantie. De precieze voorwaarden, ook voor retourneren, staan op de pagina{" "}
          <Link href={businessInfo.legal.returnPolicyUrl} className={contentLinkClass}>
            retourneren
          </Link>{" "}
          en in de{" "}
          <Link href={businessInfo.legal.termsUrl} className={contentLinkClass}>
            algemene voorwaarden
          </Link>
          .
        </p>
      </ContentSection>
    </ContentPage>
  );
}
