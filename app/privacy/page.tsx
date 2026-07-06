import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo, getFullAddress } from "@/lib/business-info";

export const metadata: Metadata = {
  title: `Privacybeleid — ${businessInfo.name}`,
  description:
    "Hoe Mokka Home omgaat met je persoonsgegevens: welke gegevens we verwerken, waarvoor, hoe lang we ze bewaren en welke rechten je hebt onder de AVG.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacybeleid"
      intro="We gaan zorgvuldig om met je persoonsgegevens en verwerken ze conform de Algemene Verordening Gegevensbescherming (AVG)."
    >
      <LegalSection heading="Verwerkingsverantwoordelijke">
        <p>
          {businessInfo.legalName}, gevestigd aan {getFullAddress()}, is verantwoordelijk voor de
          verwerking van persoonsgegevens zoals beschreven op deze pagina.
        </p>
      </LegalSection>
      <LegalSection heading="Welke gegevens we verwerken">
        <p>
          We verwerken de gegevens die je zelf verstrekt bij een bestelling of contactaanvraag:
          naam, bezorg- en factuuradres, e-mailadres en telefoonnummer, plus de gegevens van je
          bestelling. Daarnaast verwerken we technische gegevens (zoals IP-adres) voor de werking
          en beveiliging van de website.
        </p>
      </LegalSection>
      <LegalSection heading="Waarvoor we ze gebruiken">
        <p>
          We gebruiken je gegevens om je bestelling te verwerken en te bezorgen, om contact met je
          op te nemen over je bestelling, en om wettelijke verplichtingen (zoals de
          fiscale bewaarplicht) na te komen.
        </p>
      </LegalSection>
      <LegalSection heading="Delen met derden">
        <p>
          We verkopen je gegevens nooit. We delen ze alleen met partijen die nodig zijn om je
          bestelling uit te voeren: onze betaaldienstverlener (voor de afhandeling van je betaling),
          de bezorgpartner (voor de levering) en onze IT-dienstverleners voor hosting, het tonen van
          afbeeldingen en het bewaken van de werking en veiligheid van de website. Met deze partijen
          zijn verwerkersafspraken gemaakt en zij mogen je gegevens alleen voor dat doel gebruiken.
        </p>
      </LegalSection>
      <LegalSection heading="Nieuwsbrief">
        <p>
          Meld je je aan voor de nieuwsbrief, dan gebruiken we je e-mailadres alleen daarvoor. In
          iedere nieuwsbrief staat een afmeldlink; afmelden kan op elk moment.
        </p>
      </LegalSection>
      <LegalSection heading="Beveiliging">
        <p>
          Je gegevens worden via een versleutelde verbinding (HTTPS) verstuurd. We nemen passende
          technische en organisatorische maatregelen om je gegevens te beschermen tegen verlies of
          onrechtmatig gebruik.
        </p>
      </LegalSection>
      <LegalSection heading="Cookies">
        <p>
          Voor de werking en het meten van de website gebruiken we cookies. Lees hier meer over in
          ons{" "}
          <a href="/cookies" className="text-accent underline underline-offset-2">cookiebeleid</a>.
        </p>
      </LegalSection>
      <LegalSection heading="Bewaartermijn">
        <p>
          We bewaren je gegevens niet langer dan nodig. Bestel- en factuurgegevens bewaren we
          conform de wettelijke fiscale bewaarplicht van 7 jaar.
        </p>
      </LegalSection>
      <LegalSection heading="Je rechten">
        <p>
          Je hebt het recht je gegevens in te zien, te corrigeren of te laten verwijderen, en het
          recht op gegevensoverdraagbaarheid. Stuur je verzoek naar {businessInfo.contact.email}.
          Je kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
