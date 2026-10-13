import type { Metadata } from "next";
import Link from "next/link";
import { ContentCta, ContentPage, ContentSection, contentLinkClass } from "@/components/content/ContentPage";
import {
  businessInfo,
  getEmailLink,
  getFullAddress,
  getMapsUrl,
  getOpeningHoursCompact,
  getPhoneLink,
} from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import type { BreadcrumbItem } from "@/lib/jsonLd";
import { ogDefaults } from "@/lib/seo";

const PATH = "/showroom";
const CITY = businessInfo.address.city;
const TITLE = `Showroom in ${CITY}: adres en openingstijden`;
const DESCRIPTION = `Bezoek de showroom van ${businessInfo.name}, ${businessInfo.address.street} in ${CITY}. Banken, tafels en bedden in het echt, met advies over maten en stoffen.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  ...ogDefaults({ title: `${TITLE} | ${businessInfo.name}`, description: DESCRIPTION, url: PATH }),
};

const breadcrumbs: BreadcrumbItem[] = [
  { name: "Home", url: "/" },
  { name: "Showroom", url: PATH },
];

const DAYS: ReadonlyArray<{ key: keyof typeof businessInfo.openingHours; label: string }> = [
  { key: "monday", label: "Maandag" },
  { key: "tuesday", label: "Dinsdag" },
  { key: "wednesday", label: "Woensdag" },
  { key: "thursday", label: "Donderdag" },
  { key: "friday", label: "Vrijdag" },
  { key: "saturday", label: "Zaterdag" },
  { key: "sunday", label: "Zondag" },
];

export default function ShowroomPage() {
  const { address } = businessInfo;
  const phoneLink = getPhoneLink();
  const phone = businessInfo.contact.phoneFormatted;
  const emailLink = getEmailLink();
  const hoursCompact = getOpeningHoursCompact();
  const hasAddress = !!address.street && !!address.city;

  const faq = [
    {
      q: "Moet ik een afspraak maken?",
      a: `Nee, je kunt tijdens de openingstijden gewoon binnenlopen. Wil je zeker weten dat er iemand de tijd voor je heeft, bijvoorbeeld om een complete woonkamer of slaapkamer door te nemen, stuur dan vooraf een bericht via de contactpagina of bel ons.`,
    },
    {
      q: "Staat alles uit de webshop in de showroom?",
      a: "Niet alles: de webshop is groter dan de showroom. Wil je een specifiek product, een stof of een kleur zien, vraag dan vooraf even naar de mogelijkheden; dan weet je zeker dat je niet voor niets komt.",
    },
    {
      q: "Kan ik in de showroom bestellen en betalen?",
      a: "Ja. Je kunt ter plekke bestellen; de prijzen en levertijden zijn dezelfde als online. Bestellen kan ook thuis via de webshop als je er nog even over wilt nadenken.",
    },
    {
      q: "Kan ik mijn maten meenemen?",
      a: "Graag zelfs. Een plattegrond of de maten van je kamer, de deur en de trap helpen ons om samen uit te rekenen wat past. Neem ook gerust een foto van je interieur mee voor kleuradvies.",
    },
    {
      q: "Waar kan ik parkeren?",
      a: "Bel ons even voor je komt, dan vertellen we waar je op dat moment het beste kunt parkeren.",
    },
  ];

  return (
    <ContentPage
      eyebrow="Showroom"
      title={`Showroom in ${CITY}`}
      intro="Een bank koop je niet van een foto. In de showroom zit je op de modellen, voel je de stoffen en zie je de kleuren bij daglicht. Loop binnen tijdens de openingstijden; een afspraak is niet nodig."
      breadcrumbs={breadcrumbs}
      faq={faq}
      footer={
        <ContentCta
          heading="Kom langs of maak een afspraak"
          text={
            <>
              Wil je zeker weten dat we tijd voor je hebben, of een specifiek product zien? Stuur een bericht via de contactpagina
              {phoneLink && phone && (
                <>
                  {" "}
                  of bel{" "}
                  <a href={phoneLink} className={contentLinkClass} aria-label={`Bel ons: ${phone}`}>
                    {phone}
                  </a>
                </>
              )}
              . Vermeld als onderwerp &ldquo;Interieuradvies&rdquo; en wanneer je wilt komen.
            </>
          }
          primary={{ href: "/contact", label: "Maak een afspraak" }}
          secondary={{ href: "/banken", label: "Bekijk de banken" }}
        />
      }
    >
      <ContentSection heading="Adres en openingstijden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <h3 className="text-base font-medium text-ink uppercase tracking-[0.12em] mb-3">Adres</h3>
            <address className="not-italic text-[17px] leading-[1.7] text-graphite">
              <span className="block text-ink">{businessInfo.name}</span>
              <span className="block">{address.street}</span>
              <span className="block">
                {address.postalCode} {address.city}
              </span>
              {hasAddress && (
                <a href={getMapsUrl()} target="_blank" rel="noopener noreferrer" className={`inline-block mt-3 min-h-11 ${contentLinkClass}`}>
                  Routebeschrijving (opent in Google Maps)
                </a>
              )}
            </address>
          </div>
          <div>
            <h3 className="text-base font-medium text-ink uppercase tracking-[0.12em] mb-3">Openingstijden</h3>
            <dl className="text-[17px] leading-[1.7] text-graphite">
              {DAYS.map((d) => {
                const hours = businessInfo.openingHours[d.key];
                return (
                  <div key={d.key} className="flex justify-between gap-6 border-b border-line py-1.5">
                    <dt>{d.label}</dt>
                    <dd className={hours ? "text-ink tabular-nums" : "text-stone"}>{hours ?? "Gesloten"}</dd>
                  </div>
                );
              })}
            </dl>
            {hoursCompact.length > 0 && <p className="text-sm text-stone mt-3">Kort: {hoursCompact.join(" · ")}</p>}
          </div>
        </div>
        {(phoneLink || emailLink) && (
          <p>
            Bereikbaar
            {phoneLink && phone && (
              <>
                {" "}
                op{" "}
                <a href={phoneLink} className={contentLinkClass} aria-label={`Bel ons: ${phone}`}>
                  {phone}
                </a>
              </>
            )}
            {phoneLink && emailLink && " en"}
            {emailLink && (
              <>
                {" "}
                via{" "}
                <a href={emailLink} className={contentLinkClass}>
                  {businessInfo.contact.email}
                </a>
              </>
            )}
            .
          </p>
        )}
      </ContentSection>

      {hasAddress && (
        <ContentSection heading="Routebeschrijving">
          <p>
            De showroom zit aan de {address.street} in {address.city}. Voer <strong>{getFullAddress()}</strong> in je navigatie in, of gebruik de{" "}
            <a href={getMapsUrl()} target="_blank" rel="noopener noreferrer" className={contentLinkClass}>
              routebeschrijving in Google Maps
            </a>
            . Kom je met het openbaar vervoer of weet je niet waar je kunt parkeren, bel ons dan even voor je vertrekt; we wijzen je de weg.
          </p>
        </ContentSection>
      )}

      <ContentSection heading="Wat je in de showroom kunt doen">
        <ul>
          <li>
            <strong>Modellen in het echt.</strong> Bekijk de hoekbanken, bankstellen en boxsprings van dichtbij en vergelijk zitdiepte, hardheid en afwerking. Dat zegt meer dan elke productbeschrijving.
          </li>
          <li>
            <strong>Stoffen en kleuren bij daglicht.</strong> Je ziet stoffen, leer en houtsoorten in het echt en kunt de kleur naast een foto of staal van je eigen vloer of muur houden. Vraag vooraf naar de mogelijkheden voor een specifieke stof of kleur.
          </li>
          <li>
            <strong>Maten doorrekenen.</strong> Neem de maten van je kamer, deur en trap mee. We rekenen samen uit welke bank, tafel of bedmaat past en hoeveel loopruimte je overhoudt.
          </li>
          <li>
            <strong>Bestellen en afspraken maken.</strong> Je kunt ter plekke bestellen tegen dezelfde prijzen en levertijden als online, en direct bespreken hoe de bezorging en eventuele montage geregeld worden.
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="Zo bereid je je bezoek voor">
        <ol>
          <li>Meet je kamer op: de lengte en breedte van de ruimte, en de plek waar het meubel komt.</li>
          <li>Meet de doorgang: voordeur, gang, trap en bochten. Een standaard deur is 83 cm breed.</li>
          <li>Maak een foto van je interieur, zodat we kleuren en materialen kunnen afstemmen op wat je al hebt.</li>
          <li>Kijk vooraf in de webshop welke modellen je interessant vindt, dan weten we waar we moeten beginnen.</li>
        </ol>
        <p>
          Praktische vuistregels voor maten vind je alvast in onze{" "}
          <Link href="/gids" className={contentLinkClass}>
            woongidsen
          </Link>
          , bijvoorbeeld over{" "}
          <Link href="/gids/hoekbank-kiezen" className={contentLinkClass}>
            een hoekbank kiezen
          </Link>{" "}
          of{" "}
          <Link href="/gids/eettafel-maat-kiezen" className={contentLinkClass}>
            de juiste eettafelmaat
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="Bestellen in de showroom of online">
        <p>
          Of je nu in de showroom of in de webshop bestelt: de prijzen zijn inclusief btw, de levertijd staat bij elk product. Vanaf €{shippingInfo.freeShippingThreshold} bezorgen we gratis in Nederland en België. Lees meer over{" "}
          <Link href="/bezorging" className={contentLinkClass}>
            bezorging en montage
          </Link>{" "}
          en{" "}
          <Link href="/betalen" className={contentLinkClass}>
            veilig betalen
          </Link>
          .
        </p>
      </ContentSection>
    </ContentPage>
  );
}
