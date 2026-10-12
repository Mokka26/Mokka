import type { Metadata } from "next";
import Link from "next/link";
import { ContentSection, ContentSummary, ContentTable, contentLinkClass } from "@/components/content/ContentPage";
import { businessInfo } from "@/lib/business-info";
import { categoryUrl } from "@/lib/categories";
import { GuideShell } from "../GuideShell";
import { getGuide, guidePath } from "../guides";

export const revalidate = 3600;

const guide = getGuide("bed-en-matras-kiezen");
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
    q: "Welke bedmaat past in mijn slaapkamer?",
    a: "Tel bij de bedmaat 60 tot 70 cm loopruimte op aan elke vrije zijde. Een bed van 160 x 200 cm vraagt zo een ruimte van ongeveer 3 x 3,5 m, een bed van 180 x 200 cm minstens 3,2 x 3,5 m.",
  },
  {
    q: "Hoe lang moet mijn bed zijn?",
    a: "Een vuistregel: je lichaamslengte plus 20 cm. Tot 1,80 m volstaat een matras van 200 cm; ben je 1,90 m of langer, kies dan 210 of 220 cm als de serie dat biedt.",
  },
  {
    q: "Kan ik twee losse matrassen in een tweepersoonsbed leggen?",
    a: "Ja. Bij 160 of 180 cm breed kun je kiezen voor twee matrassen van 80 of 90 cm, zodat ieder zijn eigen hardheid kiest. Een topper over beide matrassen heen verbergt de naad.",
  },
];

export default function BedEnMatrasKiezenPage() {
  return (
    <GuideShell
      guide={guide}
      intro="Een bed koop je voor tien jaar of langer, dus de maat moet kloppen: breed genoeg voor wie erin slaapt, lang genoeg voor de langste slaper en passend in de kamer. Deze gids zet de matrasmaten op een rij, legt het verschil uit tussen boxspring en bedframe en rekent de ruimte voor nachtkastjes mee."
      faq={faq}
      productsHeading="Bedden uit de collectie"
    >
      <ContentSection heading="Matrasmaten: van 90 x 200 tot 180 x 200 cm">
        <p>
          In de collectie vind je bedden en matrassen in de gangbare maten van 90 x 200 cm (eenpersoons) tot 180 x 200 cm (tweepersoons). Als vuistregel heeft een volwassene <strong>80 tot 90 cm breedte</strong> nodig om vrij te kunnen draaien zonder de ander te storen. Bij een tweepersoonsbed van 140 cm heeft ieder dus 70 cm, bij 180 cm ieder 90 cm, net zo veel als in een eenpersoonsbed.
        </p>
        <ContentTable
          caption="Richtlijn: matrasmaat, gebruik en benodigde slaapkamer met 60 tot 70 cm loopruimte aan de vrije zijden."
          head={["Matrasmaat", "Geschikt voor", "Breedte per persoon", "Minimale kamermaat"]}
          rows={[
            ["90 x 200 cm", "1 persoon", "90 cm", "ca. 2,2 x 3,3 m"],
            ["140 x 200 cm", "2 personen, compact", "70 cm", "ca. 2,8 x 3,3 m"],
            ["160 x 200 cm", "2 personen, standaard", "80 cm", "ca. 3 x 3,5 m"],
            ["180 x 200 cm", "2 personen, ruim", "90 cm", "ca. 3,2 x 3,5 m"],
          ]}
        />
        <p>
          De kamermaat gaat uit van een bed met het hoofdeinde tegen de muur en 60 tot 70 cm loopruimte aan beide lange zijden en aan het voeteneinde. Staat het bed met één zijde tegen de muur, dan heb je aan die kant geen loopruimte nodig, maar instappen en opmaken wordt wel lastiger.
        </p>
      </ContentSection>

      <ContentSection heading="Bedlengte: lichaamslengte plus 20 cm">
        <p>
          Een algemeen aanvaarde vuistregel voor de lengte van het matras is <strong>je lichaamslengte plus 20 cm</strong>: ruimte voor je hoofd op het kussen en voor je voeten zonder dat ze tegen het voeteneinde komen. Tot 1,80 m volstaat de standaardlengte van 200 cm. Ben je 1,90 m of langer, kijk dan naar 210 of 220 cm. Niet elke serie biedt die lengtes; in de specificaties en bij de maatkeuze op de productpagina zie je welke maten er zijn.
        </p>
        <p>
          Let op het verschil tussen de matrasmaat en de buitenmaat van het bed. Een boxspring van 180 x 200 cm is door het hoofdbord en de omranding al snel 190 tot 200 cm breed en 215 tot 225 cm lang. De buitenmaat staat bij de specificaties; die maat gebruik je om te bepalen of het in de kamer past.
        </p>
      </ContentSection>

      <ContentSection heading="Boxspring of bedframe?">
        <p>
          Een <strong>boxspring</strong> is een compleet bed: een geveerde onderbox, een matras en vaak een topper, in één keer op elkaar afgestemd. Je ligt hoger, rond de 60 cm, wat het in- en uitstappen makkelijker maakt. Dat is prettig als je wat ouder bent of last hebt van je rug of knieën. Een boxspring is wel zwaar en wordt in delen geleverd; de losse delen moeten door de deur en de trap passen.
        </p>
        <p>
          Een <strong>bedframe</strong> is alleen het frame, van hout of metaal of met een beklede rand. Je kiest zelf een lattenbodem en een matras, en kunt die later los vervangen. De lighoogte is meestal 45 tot 55 cm. Een bedframe is lichter, vaak lager en geeft meer vrijheid in de keuze van het matras, bijvoorbeeld pocketvering voor goede ventilatie en ondersteuning per zone of koudschuim als je een vlakker, veerkrachtig ligvlak wilt.
        </p>
        <p>
          Welke je kiest, hangt af van lighoogte, budget en of je het matras los wilt kunnen kiezen. Kom bij twijfel proefliggen: een paar minuten op het echte bed zegt meer dan elke beschrijving.
        </p>
      </ContentSection>

      <ContentSection heading="Nachtkastjes meerekenen">
        <p>
          Nachtkastjes horen bij de maat van het bed. Een nachtkastje is meestal 40 tot 60 cm breed; tel aan beide zijden die breedte op bij de buitenmaat van het bed. Een bed van 180 cm breed met twee nachtkastjes van 50 cm vraagt dus een wand van minstens 280 cm, nog zonder loopruimte om de kastjes heen.
        </p>
        <p>
          Kies de hoogte van het nachtkastje op de lighoogte: ongeveer gelijk aan de bovenkant van het matras of iets lager, zodat je zonder reiken bij je glas water of je wekker kunt. Bij een boxspring van 60 cm hoog is een nachtkastje van 50 tot 60 cm passend; bij een laag bedframe eerder 40 tot 45 cm. Bij sommige bedden in de collectie zijn bijpassende nachtkastjes inbegrepen of los bij te bestellen; dat staat op de productpagina.
        </p>
      </ContentSection>

      <ContentSection heading="Meet de doorgang en de kamer">
        <p>
          Teken de slaapkamer uit met het bed, de nachtkastjes, de kledingkast en de deuren die open moeten kunnen. Houd 60 tot 70 cm loopruimte aan de vrije zijden en zorg dat een kastdeur niet tegen het bed aan komt. Meet ook de route naar binnen: een standaard deur is 83 cm breed, een boxspring-onderbox is meestal 90 cm breed per helft en past gekanteld. Een smalle trap met een bocht is het grootste risico; de maten per deel staan bij de specificaties.
        </p>
      </ContentSection>

      <ContentSummary
        items={[
          "Reken 80 tot 90 cm breedte per volwassene; 160 x 200 cm is de gangbare tweepersoonsmaat, 180 x 200 cm geeft ieder 90 cm.",
          "Matraslengte is lichaamslengte plus 20 cm; vanaf 1,90 m kies je 210 of 220 cm.",
          "Houd 60 tot 70 cm loopruimte aan de vrije zijden; een bed van 160 x 200 cm vraagt ongeveer 3 x 3,5 m.",
          "Een boxspring is compleet en hoog (ca. 60 cm), een bedframe is lager en laat je het matras zelf kiezen.",
          "Tel nachtkastjes (40 tot 60 cm per stuk) op bij de breedte van de wand.",
          "Gebruik de buitenmaat van het bed, niet de matrasmaat, om te bepalen of het past.",
        ]}
      />

      <ContentSection heading="Verder lezen">
        <p>
          Bekijk de{" "}
          <Link href={categoryUrl("bedden")} className={contentLinkClass}>
            bedden
          </Link>
          , de{" "}
          <Link href={categoryUrl("matrassen")} className={contentLinkClass}>
            matrassen
          </Link>{" "}
          en de{" "}
          <Link href={categoryUrl("nachtkastjes")} className={contentLinkClass}>
            nachtkastjes
          </Link>
          . Voor de woonkamer helpen de gidsen{" "}
          <Link href={guidePath("hoekbank-kiezen")} className={contentLinkClass}>
            een hoekbank kiezen
          </Link>{" "}
          en{" "}
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
