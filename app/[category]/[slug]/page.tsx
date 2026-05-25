import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductDetailClient from "@/app/products/[slug]/ProductDetailClient";
import RecentlyViewed from "@/components/RecentlyViewed";
import {
  CATEGORIES,
  dbCategoryToRouteSlug,
  getCategory,
  isCategorySlug,
} from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";
import { firstImageUrl, parseImages } from "@/lib/imageHelpers";
import { shippingInfo } from "@/lib/shipping-info";
import { jsonLdHtml } from "@/lib/jsonLd";

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

// Pre-render alle (category, slug)-paren bij build voor SSG
export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { hidden: false, deletedAt: null },
    select: { slug: true, category: true },
  });
  return products.map((p) => ({
    category: dbCategoryToRouteSlug(p.category),
    slug: p.slug,
  }));
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: categorySlug, slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, hidden: false, deletedAt: null },
  });
  if (!product) return { title: "Product niet gevonden" };

  const url = `/${categorySlug}/${product.slug}`;
  const heroImage = firstImageUrl(product.images);

  return {
    title: `${product.name} — ${businessInfo.name}`,
    description: product.description.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      type: "website",
      url,
      images: heroImage ? [{ url: heroImage }] : undefined,
    },
  };
}

export default async function ProductPageInCategory({ params }: Props) {
  const { category: categorySlug, slug } = await params;

  if (!isCategorySlug(categorySlug)) notFound();
  const category = getCategory(categorySlug);
  if (!category) notFound();

  const product = await prisma.product.findFirst({
    where: { slug, hidden: false, deletedAt: null },
  });
  if (!product) notFound();

  // Hoort dit product wel in deze categorie? Zo niet → redirect naar canonieke URL
  if (!category.dbCategories.includes(product.category)) {
    const canonicalCategory = dbCategoryToRouteSlug(product.category);
    redirect(`/${canonicalCategory}/${product.slug}`);
  }

  // Voor umbrella's: canonieke URL is de specifieke categorie, niet de umbrella
  if (category.isUmbrella) {
    const canonicalCategory = dbCategoryToRouteSlug(product.category);
    if (canonicalCategory !== category.slug) {
      redirect(`/${canonicalCategory}/${product.slug}`);
    }
  }

  // Related + color variants — zelfde logica als oude route
  const [relatedProducts, colorVariants] = await Promise.all([
    prisma.product.findMany({
      where: {
        category: product.category,
        id: { not: product.id },
        hidden: false,
        deletedAt: null,
      },
      take: 4,
    }),
    product.colorGroup
      ? prisma.product.findMany({
          where: { colorGroup: product.colorGroup, deletedAt: null },
          select: { id: true, slug: true, colorName: true, colorHex: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // JSON-LD: Product + BreadcrumbList
  const images = parseImages(product.images).map((i) => i.url);
  const productSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.slug,
    image: images,
    brand: { "@type": "Brand", name: businessInfo.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: product.price.toFixed(2),
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `/${category.slug}/${product.slug}`,
      seller: { "@type": "Organization", name: businessInfo.legalName },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value:
            product.price >= shippingInfo.freeShippingThreshold ? 0 : shippingInfo.rates.standard,
          currency: "EUR",
        },
        shippingDestination: shippingInfo.freeShippingCountries.map((c) => ({
          "@type": "DefinedRegion",
          addressCountry: c,
        })),
      },
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: category.label,
        item: `/${category.slug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `/${category.slug}/${product.slug}`,
      },
    ],
  };

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
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
        colorVariants={colorVariants}
      />
      <RecentlyViewed currentSlug={product.slug} />
    </>
  );
}

// Ensure CATEGORIES wordt gebundeld (anders tree-shake door static gen)
void CATEGORIES;
