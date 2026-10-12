import type { ReactNode } from "react";
import { ContentCta, ContentPage, type ContentProductsSection, type FaqItem } from "@/components/content/ContentPage";
import { getGuideProducts } from "@/components/content/guideProducts";
import { businessInfo } from "@/lib/business-info";
import { categoryUrl, getCategory } from "@/lib/categories";
import { buildArticleJsonLd, type BreadcrumbItem } from "@/lib/jsonLd";
import { GIDS_PATH, guidePath, type Guide } from "./guides";

/**
 * Gedeelde wrapper voor één gids: breadcrumbs (Home > Gids > titel),
 * Article-schema, productsectie uit de gekoppelde categorie en een CTA naar
 * de categorie en de showroom. Server component.
 */
export async function GuideShell({
  guide,
  intro,
  children,
  faq,
  productsHeading,
}: {
  guide: Guide;
  intro: string;
  children: ReactNode;
  faq?: ReadonlyArray<FaqItem>;
  productsHeading: string;
}) {
  const path = guidePath(guide.slug);
  const primary = getCategory(guide.categories[0]);
  const primaryHref = primary ? categoryUrl(primary.slug) : "/products";
  const primaryLabel = primary ? primary.label : "de collectie";
  const products = await getGuideProducts(guide.productCategories);

  const breadcrumbs: BreadcrumbItem[] = [
    { name: "Home", url: "/" },
    { name: "Gids", url: GIDS_PATH },
    { name: guide.title, url: path },
  ];

  const article = buildArticleJsonLd({
    headline: guide.title,
    description: guide.description,
    url: path,
    datePublished: guide.datePublished,
    dateModified: guide.dateModified,
  });

  const productSection: ContentProductsSection | undefined =
    products.length > 0
      ? {
          heading: productsHeading,
          intro: "Op voorraad en direct te bestellen; de maten staan bij elk product.",
          products,
          ctaHref: primaryHref,
          ctaLabel: `Alle ${primaryLabel.toLowerCase()}`,
        }
      : undefined;

  return (
    <ContentPage
      eyebrow="Woongids"
      title={guide.title}
      intro={intro}
      breadcrumbs={breadcrumbs}
      faq={faq}
      products={productSection}
      jsonLd={[article]}
      footer={
        <ContentCta
          heading="Liever even zien en voelen?"
          text={`In de showroom in ${businessInfo.address.city} staan de modellen opgesteld en rekenen we samen uit wat in jouw ruimte past. Neem de maten van je kamer mee; een afspraak is niet nodig.`}
          primary={{ href: primaryHref, label: `Bekijk ${primaryLabel.toLowerCase()}` }}
          secondary={{ href: "/showroom", label: "Naar de showroom" }}
        />
      }
    >
      {children}
    </ContentPage>
  );
}
