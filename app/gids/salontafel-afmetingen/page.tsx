import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, ContentSummary, ContentTable, contentLinkClass } from "@/components/content/ContentPage";
import { businessInfo } from "@/lib/business-info";
import { categoryUrl } from "@/lib/categories";
import { GuideShell } from "../GuideShell";
import { getGuide, guidePath } from "../guides";

export const revalidate = 3600;

const guide = getGuide("salontafel-afmetingen");
const PATH = guidePath(guide.slug);

export const metadata: Metadata = {
  title: guide.metaTitle,
  description: guide.description,
  alternates: { canonical: PATH },
  openGraph: {
    title: `${guide.metaTitle} | ${businessInfo.name}`,
    description: guide.description,
    type: "article",
    url: PATH,
    locale: "nl_NL",
    publishedTime: guide.datePublished,
    modifiedTime: guide.dateModified,
  },
};

const faq = [
  {
    q: "Welke maat salontafel past bij een bank van 240 cm?",
    a: "Neem ongeveer twee derde van de zitlengte: bij 240 cm komt dat op een tafel van 140 tot 160 cm lang. Houd daarnaast 40 tot 45 cm ruimte tussen bank en tafel.",
  },
  {
    q: "Mag een salontafel hoger zijn dan de bank?",
    a: "Liever niet. Een blad dat boven de zitting uitsteekt zit in de weg als je gaat zitten en oogt zwaar. Gelijk aan de zithoogte of een paar centimeter lager is de vuistregel.",
  },
  {
    q: "Wat is het verschil tussen een salontafel en een bijzettafel?",
    a: "Een salontafel staat vóór de bank en is het middelpunt van de zithoek. Een bijzettafel is kleiner en staat naast de bank of een fauteuil, binnen handbereik voor een kop koffie of een lamp. Ze vullen elkaar aan.",
  },
];

export default function SalontafelAfmetingenPage() {
  return (
    <GuideShell
      guide={guide}
      intro="Een salontafel kies je op de maat van je bank, niet op de maat van de kamer. Drie vuistregels, de hoogte ten opzichte van de zitting, de afstand tot de bank en de lengte ten opzichte van de bank, bepalen of de tafel klopt. Daarna pas komen vorm en materiaal."
      faq={faq}
      productsHeading="Salontafels uit de collectie"
    >
      <ContentSection heading="Hoogte: ongeveer de zithoogte van de bank">
        <p>
          Een algemeen aanvaarde vuistregel is dat het tafelblad <strong>op dezelfde hoogte ligt als de zitting van de bank, of iets lager</strong>. De meeste banken hebben een zithoogte van 40 tot 45 cm; een salontafel van 35 tot 45 cm hoog past daar goed bij. Je pakt dan een kop koffie zonder te bukken of te reiken, en de tafel oogt in verhouding met de bank.
        </p>
        <p>
          Heb je een lage loungebank van 38 cm, kies dan ook een lage tafel van 30 tot 38 cm. Bij een hoge bank van 48 cm mag de tafel 45 cm zijn. Een tafel die hoger is dan de zitting zit in de weg bij het gaan zitten en maakt de zithoek visueel zwaar.
        </p>
      </ContentSection>

      <ContentSection heading="Afstand tot de bank: 40 tot 45 cm">
        <p>
          Tussen de voorkant van de bank en de rand van de tafel houd je <strong>40 tot 45 cm</strong> aan. Dat is genoeg om je benen te strekken en om langs de tafel te lopen zonder je schenen te stoten, en dichtbij genoeg om iets van tafel te pakken zonder op te staan. Bij een hoekbank geldt dezelfde afstand aan beide zijden van de hoek.
        </p>
        <p>
          Staat de tafel in een looproute, bijvoorbeeld tussen de bank en de deur naar de keuken, reken dan aan die kant op 80 cm vrije ruimte. Zo komt niemand klem te zitten als er mensen op de bank zitten.
        </p>
      </ContentSection>

      <ContentSection heading="Lengte: ongeveer twee derde van de bank">
        <p>
          Een tafel die te klein is, verdwijnt visueel; een tafel die te groot is, blokkeert de zithoek. De vuistregel is een tafellengte van <strong>ongeveer twee derde van de zitlengte van de bank</strong>. Meet daarvoor de zitting, zonder de armleuningen.
        </p>
        <ContentTable
          caption="Richtlijn: tafellengte van ongeveer twee derde van de zitlengte van de bank."
          head={["Zitlengte bank", "Tafellengte (rechthoekig)", "Doorsnede (rond)"]}
          rows={[
            ["180 cm (tweezits)", "110 - 120 cm", "80 - 90 cm"],
            ["210 cm (driezits)", "130 - 140 cm", "90 - 100 cm"],
            ["240 cm (grote driezits)", "150 - 160 cm", "100 - 110 cm"],
            ["Hoekbank 280 x 200 cm", "120 - 140 cm of twee kleinere tafels", "100 - 120 cm"],
          ]}
        />
        <p>
          Bij een hoekbank is de lengte van het rechte deel bepalend. Een set van twee kleinere tafels in verschillende hoogtes is daar vaak praktischer dan één grote: je schuift ze naar waar je ze nodig hebt.
        </p>
      </ContentSection>

      <ContentSection heading="Rond, rechthoekig of ovaal?">
        <p>
          Een <strong>ronde tafel</strong> werkt goed in een kleine woonkamer en bij een hoekbank: je loopt er makkelijk omheen, er zijn geen hoeken om je aan te stoten en je kunt er vanaf elke zitplaats bij. Voor een kleine ruimte of een gezin met jonge kinderen is rond daarom vaak de verstandigste keuze.
        </p>
        <p>
          Een <strong>rechthoekige tafel</strong> volgt de lijn van een rechte bank en biedt het meeste bladoppervlak voor boeken, een dienblad en een plant. In een lange, smalle kamer past hij beter dan een ronde tafel. Een <strong>ovale tafel</strong> combineert de lengte van een rechthoek met de zachte vorm van een ronde tafel.
        </p>
        <p>
          Let bij een glazen of marmeren blad op het gewicht en op krasgevoeligheid; bij een houten blad op onderhoud met olie of lak. In de specificaties staat het materiaal per tafel.
        </p>
      </ContentSection>

      <ContentSection heading="Bijzettafels als aanvulling">
        <p>
          Een bijzettafel naast de bank of fauteuil vult de salontafel aan: iets kleiner, iets hoger (meestal 45 tot 60 cm, op armleuninghoogte) en binnen handbereik voor een lamp of een glas. In een kleine woonkamer kunnen twee bijzettafels zelfs de salontafel vervangen; je houdt dan meer vloer vrij. Bekijk de{" "}
          <Link href={categoryUrl("bijzettafels")} className={contentLinkClass}>
            bijzettafels
          </Link>{" "}
          en let op de hoogte ten opzichte van je armleuning.
        </p>
      </ContentSection>

      <ContentSection heading="Zo meet je het uit">
        <ol>
          <li>Meet de zithoogte van je bank (van de vloer tot de bovenkant van de zitting) en de zitlengte zonder armleuningen.</li>
          <li>Neem twee derde van de zitlengte als richtlijn voor de tafellengte.</li>
          <li>Leg een krant of tape op de vloer in de maat van de tafel, 40 tot 45 cm van de bank, en loop er een dag omheen.</li>
          <li>Controleer de hoogte in de specificaties: gelijk aan de zithoogte of iets lager.</li>
        </ol>
      </ContentSection>

      <ContentSummary
        items={[
          "Bladhoogte ongeveer gelijk aan de zithoogte van de bank (40 tot 45 cm) of iets lager.",
          "Houd 40 tot 45 cm tussen bank en tafel; 80 cm aan de kant van een looproute.",
          "Tafellengte ongeveer twee derde van de zitlengte: bij een bank van 240 cm een tafel van 150 tot 160 cm.",
          "Rond of ovaal in kleine ruimtes en bij een hoekbank; rechthoekig bij een rechte bank in een lange kamer.",
          "Bij een hoekbank zijn twee kleinere tafels vaak handiger dan één grote.",
          "Bijzettafels zijn iets hoger (45 tot 60 cm) en staan naast de bank, binnen handbereik.",
        ]}
      />

      <ContentSection heading="Verder lezen">
        <p>
          Bekijk de{" "}
          <Link href={categoryUrl("salontafels")} className={contentLinkClass}>
            salontafels
          </Link>{" "}
          en{" "}
          <Link href={categoryUrl("bijzettafels")} className={contentLinkClass}>
            bijzettafels
          </Link>
          . Kies je ook een nieuwe bank, lees dan eerst de gids{" "}
          <Link href={guidePath("hoekbank-kiezen")} className={contentLinkClass}>
            een hoekbank kiezen
          </Link>
          . Alle gidsen staan op de{" "}
          <Link href="/gids" className={contentLinkClass}>
            overzichtspagina
          </Link>
          .
        </p>
      </ContentSection>
    </GuideShell>
  );
}
