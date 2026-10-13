import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, ContentSummary, ContentTable, contentLinkClass } from "@/components/content/ContentPage";
import { businessInfo } from "@/lib/business-info";
import { GUIDELINES as G, categoryUrl, cmRange } from "@/lib/categories";
import { ogDefaults } from "@/lib/seo";
import { GuideShell } from "../GuideShell";
import { getGuide, guidePath } from "../guides";

export const revalidate = 3600;

const guide = getGuide("hoekbank-kiezen");
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
    q: "Wat is het verschil tussen een hoekbank en een bankstel?",
    a: "Een hoekbank is één aaneengesloten meubel in L- of U-vorm. Een bankstel bestaat uit losse banken, bijvoorbeeld een driezits en een tweezits, die je vrij kunt neerzetten. Een hoekbank biedt meer zitplaatsen op dezelfde vloeroppervlakte; een bankstel is flexibeler bij verhuizen of herinrichten.",
  },
  {
    q: "Past een hoekbank door mijn deur?",
    a: `Hoekbanken worden in losse delen geleverd. Het grootste deel is meestal 90 tot 100 cm diep en past gekanteld door een standaard deur van ${G.doorWidthCm} cm. Meet ook de gang, de trap en bochten; de maten per deel staan bij de specificaties.`,
  },
  {
    q: "Welke zitdiepte is prettig?",
    a: `${cmRange(G.sofaSeatDepthCm)} zit rechtop en is prettig voor een televisieavond. ${G.sofaLoungeDepthCm} cm of meer is een loungediepte: je zit half liggend, vaak met extra kussens in de rug.`,
  },
];

export default function HoekbankKiezenPage() {
  return (
    <GuideShell
      guide={guide}
      intro="Een hoekbank is vaak het grootste meubel in huis en staat er jaren. De keuze draait om vier vragen: L- of U-vorm, links of rechts, welke maat bij je kamer past en stof of leer. Deze gids loopt ze een voor een met je door."
      faq={faq}
      productsHeading="Hoekbanken uit de collectie"
    >
      <ContentSection heading="L-vorm of U-vorm?">
        <p>
          Een <strong>L-vormige hoekbank</strong> bestaat uit een recht deel en een korter deel in een hoek van negentig graden, vaak een chaise longue waarop je je benen kwijt kunt. Deze vorm past in de meeste woonkamers, staat goed in een hoek of vrij in de ruimte, en biedt plaats aan drie tot vijf personen.
        </p>
        <p>
          Een <strong>U-vormige hoekbank</strong> heeft aan beide uiteinden een hoekdeel. Je zit tegenover elkaar, wat gezellig is met een groot gezin of als je vaak mensen over de vloer hebt. Een U-bank vraagt wel een grote ruimte: reken op minstens 300 cm breed en 200 cm diep voor de bank zelf, plus loopruimte. In een kleine kamer wordt een U-vorm al snel een barrière.
        </p>
      </ContentSection>

      <ContentSection heading="Links of rechts: zo bepaal je het">
        <p>
          Hier gaat het het vaakst mis. De richting van een hoekbank bepaal je altijd <strong>zittend of staand vóór de bank, met je gezicht naar de bank toe</strong>, dus niet vanuit de bank gezien. Zit het lange deel of de chaise longue dan aan je linkerhand, dan is het een linkse uitvoering; aan je rechterhand een rechtse.
        </p>
        <p>
          Teken de plattegrond van je kamer en zet de bank erin zoals je hem wilt gebruiken. Waar staat de televisie, waar is de looproute, aan welke kant zit het raam? Het hoekdeel staat meestal aan de kant waar je niet langs hoeft te lopen. Controleer bij het bestellen altijd welke richting de productfoto&apos;s en de specificaties aangeven; bij twijfel vragen we het na.
        </p>
      </ContentSection>

      <ContentSection heading="Welke maat past in je kamer?">
        <p>
          Begin met de ruimte, niet met de bank. Meet de muur waar de bank komt en de diepte van de kamer, en trek daar de loopruimte van af. Een algemeen aanvaarde vuistregel: houd <strong>{G.sofaWalkwayCm} cm loopruimte</strong> langs de open zijden van de bank en <strong>{cmRange(G.sofaToCoffeeTableCm)}</strong> tussen de bank en de salontafel. Zo kun je er langs en er met je benen bij.
        </p>
        <ContentTable
          caption={`Richtlijn: bankmaat ten opzichte van de woonkamer, met ${G.sofaWalkwayCm} cm loopruimte langs de open zijden.`}
          head={["Hoekbank (breedte x diepte)", "Zitplaatsen", "Minimale kamermaat"]}
          rows={[
            ["240 x 160 cm", "3 - 4", "ca. 3,5 x 3,5 m"],
            ["280 x 200 cm", "4 - 5", "ca. 4 x 4 m"],
            ["320 x 220 cm", "5 - 6", "ca. 4,5 x 4 m"],
            ["U-vorm 300 x 200 cm", "5 - 6", "ca. 4,5 x 4,5 m"],
          ]}
        />
        <p>
          Let naast de buitenmaten op de <strong>zitdiepte</strong>: {cmRange(G.sofaSeatDepthCm)} zit rechtop, {G.sofaLoungeDepthCm} cm of meer is een loungediepte waarbij je half ligt. En op de <strong>zithoogte</strong>: 42 tot 45 cm is prettig om op te staan, lager voelt losser maar is voor lange avonden en stijvere knieën minder comfortabel. Vergelijk die maten in de specificaties; ze verschillen per serie meer dan je denkt.
        </p>
      </ContentSection>

      <ContentSection heading="Meet de doorgang">
        <p>
          Een hoekbank komt in losse delen, maar die delen zijn fors. Meet de breedte van je voordeur (standaard {G.doorWidthCm} cm), de gang, de trap en de bochten daarin. Het grootste deel is meestal 90 tot 100 cm diep en 70 tot 90 cm hoog en past gekanteld door een standaard deur. Woon je op een etage met een smalle trap, kijk dan naar de maat per deel in de specificaties of vraag het ons na voordat je bestelt.
        </p>
      </ContentSection>

      <ContentSection heading="Stof of leer?">
        <p>
          <strong>Stof</strong> voelt warm aan, is er in veel kleuren en structuren en is doorgaans goedkoper dan leer. Vlakgeweven stoffen zijn glad en makkelijk af te nemen; stoffen met pool (velours, chenille) voelen zachter maar laten zitsporen zien. Onderhoud: regelmatig stofzuigen met een zachte borstel en vlekken direct deppen met een vochtige doek. Kies bij huisdieren of kinderen een stof met een hoge slijtvastheid; dat getal staat bij de stofinformatie.
        </p>
        <p>
          <strong>Leer</strong> is glad, laat haren en kruimels niet vasthouden en is met een vochtige doek schoon te maken. Het voelt in de winter koeler aan en krijgt in de loop van de jaren een gebruikspatina: kleine krasjes en plooien horen erbij. Onderhoud: een paar keer per jaar voeden met een leerverzorgingsmiddel en uit direct zonlicht houden, omdat leer anders verkleurt en uitdroogt.
        </p>
        <p>
          Twijfel je? Kom de stoffen en het leer voelen in de showroom en vraag naar de mogelijkheden om een kleur naast je eigen vloer of muur te zien. Een kleur die online grijs lijkt, kan bij daglicht groen of blauw uitvallen.
        </p>
      </ContentSection>

      <ContentSection heading="Bekijk de modellen in de showroom">
        <p>
          Zitcomfort valt niet uit een productfoto te halen. In de showroom in {businessInfo.address.city} bekijk je de modellen, vergelijk je de zitdiepte en de hardheid en zie je de stoffen naast elkaar. Neem de maten van je kamer, deur en trap mee; we rekenen samen uit welke maat en richting bij je ruimte passen.
        </p>
      </ContentSection>

      <ContentSummary
        items={[
          "L-vorm past in de meeste kamers; een U-vorm vraagt minstens 4,5 x 4,5 m.",
          "Links of rechts bepaal je met je gezicht naar de bank: het hoekdeel aan je linkerhand is een linkse uitvoering.",
          `Houd ${G.sofaWalkwayCm} cm loopruimte langs de open zijden en ${cmRange(G.sofaToCoffeeTableCm)} tot de salontafel.`,
          "Een hoekbank van 280 x 200 cm vraagt een kamer van ongeveer 4 x 4 m.",
          `Zitdiepte ${cmRange(G.sofaSeatDepthCm)} zit rechtop, ${G.sofaLoungeDepthCm} cm of meer is lounge; zithoogte 42 tot 45 cm is prettig om op te staan.`,
          "Stof is warm en kleurrijk, leer is glad en makkelijk schoon te houden; beide vragen eigen onderhoud.",
          "Meet de doorgang: deur, gang, trap en bochten.",
        ]}
      />

      <ContentSection heading="Verder lezen">
        <p>
          Bekijk de{" "}
          <Link href={categoryUrl("hoekbanken")} className={contentLinkClass}>
            hoekbanken
          </Link>{" "}
          of, als je liever losse banken wilt, de{" "}
          <Link href={categoryUrl("bankstellen")} className={contentLinkClass}>
            bankstellen
          </Link>
          . Voor de tafel die erbij past lees je de gids{" "}
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
