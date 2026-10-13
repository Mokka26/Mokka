import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, ContentSummary, ContentTable, contentLinkClass } from "@/components/content/ContentPage";
import { businessInfo } from "@/lib/business-info";
import { GUIDELINES as G, categoryUrl, cmRange } from "@/lib/categories";
import { ogDefaults } from "@/lib/seo";
import { GuideShell } from "../GuideShell";
import { getGuide, guidePath } from "../guides";

export const revalidate = 3600;

const guide = getGuide("eettafel-maat-kiezen");
const PATH = guidePath(guide.slug);

export const metadata: Metadata = {
  title: guide.metaTitle,
  description: guide.description,
  alternates: { canonical: PATH },
  ...ogDefaults({
    title: `${guide.metaTitle} | ${businessInfo.name}`,
    description: guide.description,
    type: "article",
    url: PATH,
    publishedTime: guide.datePublished,
    modifiedTime: guide.dateModified,
  }),
};

const faq = [
  {
    q: "Hoeveel personen passen aan een tafel van 180 cm?",
    a: `Zes personen, met per persoon ${G.seatWidthCm} cm aan de lange zijden. Zet je er ook iemand aan de kopse kanten, dan passen er acht, maar dan zit je wat krapper.`,
  },
  {
    q: "Hoe hoog is een eettafel?",
    a: `De meeste eettafels zijn ${cmRange(G.tableHeightCm)} hoog. Kies daar stoelen bij met een zithoogte van ${cmRange(G.chairSeatHeightCm)}, zodat je ongeveer 28 tot 30 cm ruimte overhoudt tussen zitting en tafelblad.`,
  },
  {
    q: "Welke ruimte heb ik nodig voor een ronde tafel van 120 cm?",
    a: "Een ronde tafel van 120 cm doorsnede is geschikt voor vier tot vijf personen. Met 75 cm loopruimte rondom heb je een ruimte van ongeveer 2,7 x 2,7 m nodig.",
  },
];

export default function EettafelMaatKiezenPage() {
  return (
    <GuideShell
      guide={guide}
      intro={`Een eettafel kies je op het aantal mensen dat er dagelijks aan zit én op de ruimte eromheen. Met twee vuistregels, ${G.seatWidthCm} cm per zitplaats en ${cmRange(G.tableClearanceCm)} loopruimte rond de tafel, reken je in een paar minuten uit welke maat bij je eetkamer past.`}
      faq={faq}
      productsHeading="Eettafels uit de collectie"
    >
      <ContentSection heading={`Vuistregel 1: ${G.seatWidthCm} cm per zitplaats`}>
        <p>
          Een algemeen aanvaarde vuistregel is dat iedere persoon aan tafel ongeveer <strong>{G.seatWidthCm} cm breedte</strong> nodig heeft. Dan heb je ruimte voor een bord, een glas en je ellebogen zonder dat je je buurman aanstoot. Wil je ruim zitten, of heb je brede stoelen met armleuningen, reken dan {cmRange(G.seatWidthWideCm)} per persoon.
        </p>
        <p>
          Bij een rechthoekige tafel tel je de zitplaatsen aan de lange zijden; aan de kopse kanten past bij een tafelbreedte van 90 tot 100 cm nog één persoon per kant. Een tafel van 180 cm biedt zo plaats aan zes personen, en aan acht als je de kopse kanten meerekent.
        </p>
      </ContentSection>

      <ContentSection heading={`Vuistregel 2: ${cmRange(G.tableClearanceCm)} loopruimte rondom`}>
        <p>
          Minstens zo belangrijk is de ruimte rond de tafel. Om een stoel naar achteren te schuiven en op te staan heb je <strong>{cmRange(G.tableClearanceCm)}</strong> nodig, gemeten vanaf de tafelrand tot de muur of het volgende meubel. Loopt er een route langs de tafel, bijvoorbeeld van de keuken naar de woonkamer, houd dan aan die kant {cmRange(G.walkwayCm)} aan zodat iemand achter de stoelen langs kan terwijl er mensen zitten.
        </p>
        <p>
          Een rekenvoorbeeld: een tafel van 200 x 100 cm met 80 cm rondom vraagt een vrije ruimte van 3,6 x 2,6 m. Is je eetkamer 3 m breed, dan past die tafel dus alleen in de lengte van de ruimte, niet dwars.
        </p>
      </ContentSection>

      <ContentSection heading="Van personen naar tafellengte">
        <p>
          Met beide vuistregels kom je op onderstaande tabel. De lengtes gaan uit van een rechthoekige tafel van 90 tot 100 cm breed, met zitplaatsen aan de lange zijden.
        </p>
        <ContentTable
          caption={`Richtlijn: tafellengte per aantal personen, met ${G.seatWidthCm} cm per zitplaats en ${cmRange(G.tableClearanceCm)} loopruimte.`}
          head={["Personen", "Tafellengte", "Vrije ruimte (lengte x breedte)"]}
          rows={[
            ["4", "120 - 140 cm", "ca. 2,8 x 2,5 m"],
            ["6", "160 - 180 cm", "ca. 3,2 x 2,6 m"],
            ["8", "200 - 240 cm", "ca. 3,8 x 2,6 m"],
            ["10", "260 - 300 cm", "ca. 4,4 x 2,6 m"],
          ]}
        />
        <p>
          Kies bij twijfel de maat die bij je dagelijkse gebruik past, niet bij het kerstdiner. Voor de paar keer per jaar dat er meer mensen komen, is een uitschuifbare tafel een betere oplossing dan een tafel die het hele jaar te groot is.
        </p>
      </ContentSection>

      <ContentSection heading="Rond of rechthoekig?">
        <p>
          Een <strong>rechthoekige tafel</strong> benut de ruimte het efficiëntst en past goed in een langwerpige eetkamer of tegen een wand. Je kunt er het grootste aantal mensen aan kwijt per vierkante meter vloer.
        </p>
        <p>
          Een <strong>ronde tafel</strong> werkt prettig in een vierkante ruimte en bij vier tot zes personen: iedereen zit even ver van elkaar en je kijkt elkaar aan. Er zijn geen hoeken waar je je aan stoot, wat in een kleine ruimte of met kinderen handig is. Een ronde tafel van 120 cm doorsnede is geschikt voor vier tot vijf personen, 140 cm voor zes. Boven de 150 cm wordt het midden lastig bereikbaar en zit je ver uit elkaar.
        </p>
        <p>
          Een <strong>ovale tafel</strong> combineert beide: de lengte van een rechthoek met de zachte vorm van een ronde tafel. Handig als je veel mensen wilt plaatsen in een ruimte waar je vaak langs de tafel loopt.
        </p>
      </ContentSection>

      <ContentSection heading="Uitschuifbaar: wanneer handig?">
        <p>
          Een uitschuifbare tafel is de oplossing als je meestal met weinig mensen eet, maar regelmatig gasten hebt. Let bij het kiezen op drie dingen: de maat in uitgeschoven stand (reken daar ook 70 tot 80 cm loopruimte bij), waar het verlengdeel wordt bewaard als het niet in gebruik is, en of de poten na uitschuiven nog op een logische plek staan ten opzichte van de stoelen.
        </p>
        <p>
          Eet je vrijwel elke dag met zes of meer personen, dan is een vaste tafel in de juiste maat meestal praktischer: geen naden in het blad en geen uitschuifmechanisme dat je telkens moet bedienen.
        </p>
      </ContentSection>

      <ContentSection heading="Stoelen en tafelhoogte">
        <p>
          De standaard tafelhoogte is {cmRange(G.tableHeightCm)}. Daar horen stoelen bij met een zithoogte van {cmRange(G.chairSeatHeightCm)}, zodat er ongeveer 28 tot 30 cm overblijft tussen zitting en blad. Heeft de stoel armleuningen, controleer dan of die onder het blad passen; anders kun je de stoel niet aanschuiven en heb je meer loopruimte nodig. Bekijk de{" "}
          <Link href={categoryUrl("eetkamerstoelen")} className={contentLinkClass}>
            eetkamerstoelen
          </Link>{" "}
          en let op de zithoogte en breedte in de specificaties.
        </p>
      </ContentSection>

      <ContentSummary
        items={[
          `Reken ${G.seatWidthCm} cm tafelbreedte per persoon; ${cmRange(G.seatWidthWideCm)} als je ruim wilt zitten.`,
          `Houd ${cmRange(G.tableClearanceCm)} vrij rond de tafel om stoelen naar achteren te schuiven; ${cmRange(G.walkwayCm)} bij een looproute.`,
          "Vier personen: 120 tot 140 cm. Zes: 160 tot 180 cm. Acht: 200 tot 240 cm.",
          "Rond past goed in een vierkante ruimte tot zes personen; rechthoekig benut een langwerpige ruimte beter.",
          "Kies een uitschuifbare tafel als je af en toe gasten hebt, een vaste maat als je dagelijks met velen eet.",
          `Tafelhoogte ${cmRange(G.tableHeightCm)}, zithoogte stoelen ${cmRange(G.chairSeatHeightCm)}.`,
        ]}
      />

      <ContentSection heading="Verder lezen">
        <p>
          Bekijk de{" "}
          <Link href={categoryUrl("eettafels")} className={contentLinkClass}>
            eettafels
          </Link>{" "}
          en de bijpassende{" "}
          <Link href={categoryUrl("eetkamerstoelen")} className={contentLinkClass}>
            eetkamerstoelen
          </Link>
          . Twijfel je over de maat van je woonkamerbank, lees dan ook de gids{" "}
          <Link href={guidePath("hoekbank-kiezen")} className={contentLinkClass}>
            een hoekbank kiezen
          </Link>
          ; voor de tafel ervoor de gids{" "}
          <Link href={guidePath("salontafel-afmetingen")} className={contentLinkClass}>
            salontafel afmetingen
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
