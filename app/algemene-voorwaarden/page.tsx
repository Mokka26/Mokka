import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo, getFullAddress } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";

// Juridisch toetsen door de eigenaar. Art. 6 en 7 komen uit lib/shipping-info.ts
// (zelfde bron als /retourneren en de orderbevestiging); wijzig ze daar.

export const metadata: Metadata = {
  title: "Algemene voorwaarden voor je bestelling",
  description:
    "De algemene voorwaarden van Mokka Home: identiteit van de onderneming, prijzen inclusief btw, levering, betaling, het herroepingsrecht en garantie.",
  alternates: { canonical: "/algemene-voorwaarden" },
};

export default function VoorwaardenPage() {
  const days = shippingInfo.returnWindowDays;
  const { customMade } = shippingInfo;
  return (
    <LegalPage
      title="Algemene voorwaarden"
      path="/algemene-voorwaarden"
      intro="Deze voorwaarden zijn van toepassing op elke bestelling die je bij Mokka Home plaatst."
    >
      <LegalSection heading="1. Identiteit van de onderneming">
        <p>
          {businessInfo.legalName}, gevestigd aan {getFullAddress()}.
          {businessInfo.kvk ? ` KvK-nummer: ${businessInfo.kvk}.` : ""}
          {businessInfo.btw ? ` Btw-nummer: ${businessInfo.btw}.` : ""} Bereikbaar via{" "}
          {businessInfo.contact.email}.
        </p>
      </LegalSection>
      <LegalSection heading="2. Toepasselijkheid">
        <p>
          Deze voorwaarden gelden voor elk aanbod en elke overeenkomst tussen Mokka Home en de
          klant. Door een bestelling te plaatsen ga je akkoord met deze voorwaarden.
        </p>
      </LegalSection>
      <LegalSection heading="3. Prijzen en aanbod">
        <p>
          Alle prijzen zijn in euro&apos;s en inclusief btw. Kennelijke vergissingen of fouten in
          het aanbod binden ons niet. Verzendkosten en levertijd worden vóór het afronden van de
          bestelling getoond.
        </p>
      </LegalSection>
      <LegalSection heading="4. Betaling">
        <p>
          Betaling verloopt via de op de website aangeboden betaalmethoden. De bestelling wordt
          verwerkt nadat de betaling is bevestigd.
        </p>
      </LegalSection>
      <LegalSection heading="5. Levering en uitvoering">
        <p>
          We leveren binnen de bij de bestelling aangegeven levertijd. Lukt dit onverhoopt niet,
          dan informeren we je tijdig en heb je het recht de overeenkomst kosteloos te ontbinden.
        </p>
      </LegalSection>
      <LegalSection heading="6. Herroepingsrecht">
        <p>
          Je hebt {days} dagen bedenktijd om de overeenkomst zonder opgave van reden te ontbinden.
          De bedenktijd gaat in na ontvangst van het product (bij meerdere leveringen: het laatste
          product). Meld je herroeping binnen die termijn per e-mail aan {businessInfo.contact.email}
          of met het modelformulier; daarna heb je nog {days} dagen om het product terug te sturen
          of naar de showroom te brengen.
        </p>
        <p>{shippingInfo.returnInspectionCopy}</p>
        <p>
          {shippingInfo.returnFeesCopy} We betalen het aankoopbedrag terug, inclusief de standaard
          verzendkosten van de heenzending. {shippingInfo.refundCopy}
        </p>
        <p>
          Uitgezonderd is alleen {customMade.label.toLowerCase()}: {customMade.definition}.{" "}
          {customMade.returnNote} Producten in een standaarduitvoering die we voor je bij de
          fabrikant bestellen, vallen gewoon onder de bedenktijd.
        </p>
        <p>
          De procedure, het retouradres en het modelformulier vind je op de pagina{" "}
          <Link href={businessInfo.legal.returnPolicyUrl} className="text-accent-dark underline underline-offset-2 hover:text-ink">
            Retourneren
          </Link>
          .
        </p>
      </LegalSection>
      <LegalSection heading="7. Conformiteit en garantie">
        <p>
          Onze producten voldoen aan de overeenkomst en aan de wettelijke eisen. Je hebt de
          wettelijke garantie: een product moet doen wat je er redelijkerwijs van mag verwachten.
        </p>
        <p>
          Daarnaast geven we garantie op fabrieks- en materiaalfouten; de duur staat bij het
          product. {shippingInfo.legalRightsCopy}
        </p>
      </LegalSection>
      <LegalSection heading="8. Klachten">
        <p>
          Heb je een klacht? Neem contact op via {businessInfo.contact.email}. We reageren binnen
          14 dagen. Komen we er samen niet uit, dan kun je het geschil voorleggen aan de bevoegde
          rechter.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
