import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo, getFullAddress } from "@/lib/business-info";

export const metadata: Metadata = {
  title: "Privacybeleid: zo gaan we met je gegevens om",
  description:
    "Hoe Mokka Home omgaat met je persoonsgegevens: welke gegevens we verwerken, waarvoor, hoe lang we ze bewaren en welke rechten je hebt onder de AVG.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacybeleid"
      path="/privacy"
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
      <LegalSection heading="Grondslagen">
        <p>
          We verwerken je gegevens omdat dat nodig is om je bestelling uit te voeren (de
          overeenkomst), omdat de wet het vraagt (zoals de fiscale bewaarplicht), omdat jij
          toestemming geeft (nieuwsbrief, analytische en marketingcookies) of omdat we een
          gerechtvaardigd belang hebben bij een veilige, goed werkende website.
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
        <p>Concreet gaat het om:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Mollie: afhandeling van je betaling</li>
          <li>Vercel: hosting van de website</li>
          <li>Neon: de database met bestellingen en berichten</li>
          <li>Cloudinary: opslag en weergave van productfoto&apos;s</li>
          <li>Sentry: foutmeldingen van de website (zonder je naam of adres)</li>
          <li>onze e-maildienst: verzending van orderbevestigingen en de nieuwsbrief</li>
          <li>Google: alleen als je analytische of marketingcookies accepteert</li>
        </ul>
        <p>
          Alleen als je marketingcookies accepteert, meet Google Ads of een bezoek of bestelling
          voortkomt uit een advertentie. Google kan die gegevens buiten de EU verwerken; dit gebeurt
          op basis van de standaardcontractbepalingen van de EU.
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
          <Link href="/cookies" className="text-accent-dark underline underline-offset-2 hover:text-ink">cookiebeleid</Link>.
        </p>
      </LegalSection>
      <LegalSection heading="Bewaartermijn">
        <p>
          We bewaren je gegevens niet langer dan nodig. Bestel- en factuurgegevens bewaren we
          conform de wettelijke fiscale bewaarplicht van 7 jaar na afloop van het boekjaar; daarna
          wissen we je naam, adres en contactgegevens automatisch. Berichten via het contactformulier
          verwijderen we na 12 maanden. De klik-ID van een Google-advertentie bij je bestelling wissen
          we na 90 dagen. Een nieuwsbriefaanmelding die je niet binnen 7 dagen bevestigt, verwijderen
          we.
        </p>
      </LegalSection>
      <LegalSection heading="Je rechten">
        <p>
          Je hebt het recht je gegevens in te zien, te corrigeren of te laten verwijderen, en het
          recht op gegevensoverdraagbaarheid. Je mag bezwaar maken tegen verwerking op basis van
          gerechtvaardigd belang, en een gegeven toestemming altijd intrekken (cookies via
          &ldquo;Cookie-instellingen&rdquo; onderaan elke pagina). Stuur je verzoek naar {businessInfo.contact.email}.
          Je kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
