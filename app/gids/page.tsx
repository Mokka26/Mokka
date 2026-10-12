import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContentCta, ContentPage, ContentSection, contentLinkClass } from "@/components/content/ContentPage";
import { businessInfo } from "@/lib/business-info";
import { categoryUrl, getCategory } from "@/lib/categories";
import type { BreadcrumbItem } from "@/lib/jsonLd";
import { GIDS_PATH, GUIDES, guidePath } from "./guides";

const TITLE = "Woongids: maten en keuzehulp voor meubels";
const DESCRIPTION = `Gidsen van ${businessInfo.name} met vuistregels voor maten: welke eettafel voor hoeveel personen, een hoekbank links of rechts, bed- en matrasmaten en de salontafel.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: GIDS_PATH },
  openGraph: {
    title: `${TITLE} | ${businessInfo.name}`,
    description: DESCRIPTION,
    type: "website",
    url: GIDS_PATH,
    locale: "nl_NL",
  },
};

const breadcrumbs: BreadcrumbItem[] = [
  { name: "Home", url: "/" },
  { name: "Gids", url: GIDS_PATH },
];

export default function GidsPage() {
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Woongids — ${businessInfo.name}`,
    description: DESCRIPTION,
    url: `${businessInfo.siteUrl}${GIDS_PATH}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: GUIDES.length,
      itemListElement: GUIDES.map((g, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${businessInfo.siteUrl}${guidePath(g.slug)}`,
        name: g.title,
      })),
    },
  };

  return (
    <ContentPage
      eyebrow="Woongids"
      title="Woongids: maten en keuzes"
      intro="Past die hoekbank wel? Hoeveel mensen kunnen er aan een tafel van 180 cm? Deze gidsen geven je nuchtere vuistregels en rekenvoorbeelden, zodat je thuis met een meetlint kunt bepalen wat in je ruimte past, voordat je iets bestelt."
      breadcrumbs={breadcrumbs}
      jsonLd={[collectionSchema]}
      footer={
        <ContentCta
          heading="Liever samen uitrekenen?"
          text={`Neem de maten van je kamer, deur en trap mee naar de showroom in ${businessInfo.address.city}. We rekenen het met je door en je zit meteen proef. Een afspraak is niet nodig.`}
          primary={{ href: "/showroom", label: "Naar de showroom" }}
          secondary={{ href: "/contact", label: "Stel je vraag" }}
        />
      }
    >
      <section aria-labelledby="gids-overzicht">
        <h2 id="gids-overzicht" className="sr-only">
          Alle gidsen
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6 list-none m-0 p-0">
          {GUIDES.map((g) => {
            const primary = getCategory(g.categories[0]);
            return (
              <li key={g.slug} className="h-full">
                <Link
                  href={guidePath(g.slug)}
                  className="group flex flex-col h-full bg-white border border-line rounded-[10px] p-6 sm:p-8 transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                >
                  {primary && <p className="eyebrow mb-3">{primary.label}</p>}
                  <h3 className="font-serif text-2xl text-ink leading-snug mb-3">{g.title}</h3>
                  <p className="text-base leading-[1.6] text-graphite mb-6">{g.teaser}</p>
                  <span className="mt-auto inline-flex items-center gap-2 text-base font-medium text-ink group-hover:text-accent-dark">
                    Lees de gids
                    <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <ContentSection heading="Zo gebruik je de gidsen">
        <p>
          Elke gids begint met de vuistregels, geeft een tabel met maten en eindigt met een korte samenvatting. De regels zijn algemene richtlijnen voor een gemiddelde woning; je eigen ruimte, looproutes en gebruik bepalen uiteindelijk wat prettig is. De exacte maten van elk product staan bij de specificaties op de productpagina.
        </p>
        <p>
          Klaar om te kijken? Ga direct naar de{" "}
          <Link href={categoryUrl("banken")} className={contentLinkClass}>
            banken
          </Link>
          ,{" "}
          <Link href={categoryUrl("tafels")} className={contentLinkClass}>
            tafels
          </Link>{" "}
          of{" "}
          <Link href={categoryUrl("bedden")} className={contentLinkClass}>
            bedden
          </Link>
          , of lees eerst hoe{" "}
          <Link href="/bezorging" className={contentLinkClass}>
            bezorging en montage
          </Link>{" "}
          werken.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
