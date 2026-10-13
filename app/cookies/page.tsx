import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { businessInfo } from "@/lib/business-info";

export const metadata: Metadata = {
  title: "Cookiebeleid: welke cookies we gebruiken",
  description:
    "Welke cookies Mokka Home gebruikt en waarom: functionele cookies die nodig zijn voor de winkelwagen en analytische cookies die je zelf accepteert of weigert.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookiebeleid"
      path="/cookies"
      intro="We gebruiken cookies om de website te laten werken en, met jouw toestemming, om het gebruik te meten. Je bepaalt zelf wat je toestaat."
    >
      <LegalSection heading="Functionele cookies">
        <p>
          Deze zijn noodzakelijk om de website te laten werken, bijvoorbeeld om je winkelmandje te
          onthouden en je voorkeuren op te slaan. Hiervoor is geen toestemming vereist.
        </p>
      </LegalSection>
      <LegalSection heading="Analytische cookies">
        <p>
          Met jouw toestemming meten we anoniem hoe de website gebruikt wordt, zodat we hem kunnen
          verbeteren. Deze worden pas geplaatst nadat je ze via de cookiemelding hebt geaccepteerd.
        </p>
      </LegalSection>
      <LegalSection heading="Marketingcookies (Google Ads)">
        <p>
          Met jouw toestemming plaatst Google Ads een cookie waarmee we kunnen zien of een bezoek of
          bestelling het gevolg is van een advertentie. Zo weten we of onze advertenties zinvol zijn.
          Het script van Google laadt pas nadat je de cookiemelding hebt geaccepteerd; weiger je, dan
          wordt er niets van Google geladen.
        </p>
      </LegalSection>
      <LegalSection heading="Je keuze beheren">
        <p>
          Bij je eerste bezoek vragen we via de cookiemelding of je analytische en marketingcookies
          accepteert.
          Je kunt weigeren zonder dat de website minder goed werkt. Je kunt cookies ook op elk
          moment verwijderen via je browserinstellingen.
        </p>
      </LegalSection>
      <LegalSection heading="Cookies van derden">
        <p>
          Voor het tonen van afbeeldingen en het bewaken van de werking van de site maken we
          gebruik van externe diensten. Vragen hierover kun je stellen via {businessInfo.contact.email}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
