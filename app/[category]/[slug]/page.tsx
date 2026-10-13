import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductDetailClient from "@/app/products/[slug]/ProductDetailClient";
import RecentlyViewed from "@/components/RecentlyViewed";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  categoryBreadcrumbs,
  complementaryCategoryFor,
  dbCategoryToRouteSlug,
  getCategory,
  isCategorySlug,
} from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";
import { firstImageOnly } from "@/lib/imageHelpers";
import {
  buildBreadcrumbJsonLd,
  buildProductDescription,
  buildProductJsonLd,
  buildProductTitle,
  jsonLdHtml,
  type BreadcrumbItem,
} from "@/lib/jsonLd";
import { findRedirectTarget } from "@/lib/slug-redirect";

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

// Productpagina's worden ON-DEMAND gegenereerd en daarna gecached (ISR) — niet
// alle ~1200 vooraf bij de build. Die build-burst (1 DB-query per product)
// overbelast serverless Neon en laat de build vallen. Met een lege lijst +
// dynamicParams (standaard true) rendert elk onbekend pad op de eerste hit en
// blijft 1 uur gecached (revalidate). De sitemap zorgt dat Google ze vindt.
export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;
export const revalidate = 3600;

// Expliciete select: geen `source` (interne leverancierstag) en geen
// `deletedAt`/`hidden` in de payload — het filter zit in de where-clause.
const PRODUCT_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  price: true,
  listPrice: true,
  category: true,
  images: true,
  specs: true,
  sizeVariants: true,
  nachtkastMode: true,
  nachtkastPrice: true,
  nachtkastPrice2: true,
  voetbankMode: true,
  voetbankPrice: true,
  featured: true,
  stock: true,
  deliveryTime: true,
  colorGroup: true,
  colorName: true,
  colorHex: true,
} as const;

// Kaart-velden voor gerelateerde/aanvullende producten.
const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  price: true,
  listPrice: true,
  category: true,
  images: true,
  featured: true,
  stock: true,
  createdAt: true,
  deliveryTime: true,
  sizeVariants: true,
  colorGroup: true,
  colorName: true,
  colorHex: true,
  specs: true,
} as const;

/** Eén query per request, gedeeld door generateMetadata en de page. */
const getProduct = cache(async (slug: string) =>
  prisma.product.findFirst({
    where: { slug, hidden: false, deletedAt: null },
    select: PRODUCT_SELECT,
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: categorySlug, slug } = await params;
  const category = getCategory(categorySlug);
  const product = await getProduct(slug);
  if (!product || !category) {
    return { title: "Product niet gevonden", robots: { index: false, follow: false } };
  }

  const url = `/${category.slug}/${product.slug}`;
  const title = buildProductTitle(product.name, category.label);
  const description = buildProductDescription(product.description, product.name, category.label);

  return {
    // Absolute title: de layout-template zou anders "| Mokka Home" dubbel zetten.
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      url,
      locale: "nl_NL",
      // Geen `images` hier: de gegenereerde opengraph-image.tsx (product-
      // foto + prijs) maakt de OG-kaart.
    },
  };
}

export default async function ProductPageInCategory({ params }: Props) {
  const { category: categorySlug, slug } = await params;

  // 1. Categorie-validatie en product-lookup VÓÓR elke Suspense-boundary,
  //    zodat notFound()/redirect de echte HTTP-status zetten (404/308).
  if (!isCategorySlug(categorySlug)) notFound();
  const category = getCategory(categorySlug);
  if (!category) notFound();

  const product = await getProduct(slug);
  if (!product) {
    // Oude slug? → 308 naar de nieuwe canonieke URL, anders 404.
    const target = await findRedirectTarget(slug);
    if (target) permanentRedirect(target.url);
    notFound();
  }

  // 2. Hoort dit product in deze categorie? Zo niet → 308 naar de canonieke URL.
  const canonicalCategory = dbCategoryToRouteSlug(product.category);
  if (!category.dbCategories.includes(product.category)) {
    if (!canonicalCategory) notFound();
    permanentRedirect(`/${canonicalCategory}/${product.slug}`);
  }
  // Umbrella (bv. /banken/<slug>): canoniek is de specifieke categorie.
  if (category.isUmbrella && canonicalCategory && canonicalCategory !== category.slug) {
    permanentRedirect(`/${canonicalCategory}/${product.slug}`);
  }

  // 3. Kleurvarianten (alleen zichtbare), gerelateerde producten uit dezelfde
  //    categorie en "Past goed bij" uit de aanvullende categorie. Alles ná de
  //    404/redirect-checks, zodat de HTTP-status klopt.
  const complementary = complementaryCategoryFor(product.category);
  const [colorVariants, relatedProducts, complementaryProducts] = await Promise.all([
    product.colorGroup
      ? prisma.product.findMany({
          where: { colorGroup: product.colorGroup, hidden: false, deletedAt: null },
          select: { id: true, slug: true, colorName: true, colorHex: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.product.findMany({
      where: { category: product.category, id: { not: product.id }, hidden: false, deletedAt: null },
      take: 4,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      select: CARD_SELECT,
    }),
    complementary
      ? prisma.product.findMany({
          where: {
            category: { in: [...complementary.dbCategories] },
            hidden: false,
            deletedAt: null,
            price: { gt: 0 },
          },
          take: 4,
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
          select: CARD_SELECT,
        })
      : Promise.resolve([]),
  ]);
  // Payload-trim: de kaart toont alleen foto 1.
  for (const p of relatedProducts) p.images = firstImageOnly(p.images);
  for (const p of complementaryProducts) p.images = firstImageOnly(p.images);

  const url = `/${category.slug}/${product.slug}`;
  // Home > [Banken >] Hoekbanken > Product — dezelfde keten als de categoriepagina,
  // voor het zichtbare kruimelpad én het (enige) BreadcrumbList-schema hieronder.
  const breadcrumbs: BreadcrumbItem[] = [...categoryBreadcrumbs(category), { name: product.name, url }];
  const productSchema = buildProductJsonLd(product, { url: `${businessInfo.siteUrl}${url}` });
  const breadcrumbSchema = buildBreadcrumbJsonLd(breadcrumbs);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbSchema) }}
      />
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-32 lg:pt-40">
        <Breadcrumbs items={breadcrumbs} />
      </div>
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
        complementaryProducts={complementaryProducts}
        colorVariants={colorVariants}
      />
      <RecentlyViewed currentSlug={product.slug} />
    </>
  );
}
