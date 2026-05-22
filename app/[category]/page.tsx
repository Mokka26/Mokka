import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, getCategory, isCategorySlug } from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";
import CategoryListing from "./CategoryListing";

interface Props {
  params: Promise<{ category: string }>;
}

// Statisch genereren bij build voor alle bekende categorieën
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export const revalidate = 3600; // ISR — herval elke uur

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = getCategory(categorySlug);
  if (!category) return { title: "Categorie niet gevonden" };

  const url = `/${category.slug}`;
  const title = `${category.label} — ${businessInfo.name}`;
  return {
    title,
    description: category.intro.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      title,
      description: category.intro,
      type: "website",
      url,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category: categorySlug } = await params;

  if (!isCategorySlug(categorySlug)) notFound();
  const category = getCategory(categorySlug);
  if (!category) notFound();

  // Haal producten op uit alle relevante DB-categorieën (umbrella's combineren).
  // select-clause: alleen velden die CategoryListing + ProductCard tonen.
  // Skipped: description (PDP-only), updatedAt (admin-only), deliveryTime
  // (specs JSON dekt het), discount-velden indien ongebruikt op listing.
  const products = await prisma.product.findMany({
    where: {
      category: { in: [...category.dbCategories] },
      hidden: false,
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      price: true,
      category: true,
      images: true,
      featured: true,
      stock: true,
      createdAt: true,
      colorGroup: true,
      colorName: true,
      colorHex: true,
      specs: true,
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });

  // CollectionPage JSON-LD
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.label} — ${businessInfo.name}`,
    description: category.intro,
    url: `/${category.slug}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 20).map((p, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `/${category.slug}/${p.slug}`,
        name: p.name,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <CategoryListing category={category} products={products} />
    </>
  );
}
