import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo, getFullAddress } from "@/lib/business-info";

export const metadata: Metadata = {
  title: `Algemene voorwaarden — ${businessInfo.name}`,
  description:
    "De algemene voorwaarden van Mokka Home: identiteit van de onderneming, prijzen inclusief btw, levering, betaling, het herroepingsrecht en garantie.",
  alternates: { canonical: "/algemene-voorwaarden" },
};

export default function VoorwaardenPage() {
  return (
    <LegalPage
      title="Algemene voorwaarden"
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
          Je hebt 14 dagen bedenktijd om de overeenkomst zonder opgave van reden te ontbinden.
          Retourneren kan mits het product ongebruikt is en in de originele, ongeopende verpakking
          zit. Op maat gemaakte of speciaal bestelde artikelen zijn wettelijk uitgesloten van het
          herroepingsrecht. De volledige procedure en voorwaarden lees je op de pagina{" "}
          <Link href="/retourneren" className="text-accent underline underline-offset-2">
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
      </LegalSection>
      <LegalSection heading="8. Klachten">
        <p>
          Heb je een klacht? Neem contact op via {businessInfo.contact.email}. We reageren binnen
          14 dagen. Komen we er samen niet uit, dan kun je je wenden tot de Europese
          geschillencommissie (ODR-platform).
        </p>
      </LegalSection>
    </LegalPage>
  );
}
