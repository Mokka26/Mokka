import type { Metadata } from "next";
import { Suspense } from "react";
import { permanentRedirect } from "next/navigation";
import { isCategorySlug } from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";
import { prisma } from "@/lib/prisma";
import ProductsContent from "./ProductsContent";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Alle producten — ${businessInfo.name}`,
  description: `Ontdek het volledige assortiment van ${businessInfo.name}: banken, eettafels, verlichting en meer. Bekijk per categorie of doorzoek de hele collectie.`,
  alternates: { canonical: "/products" },
  openGraph: {
    title: `Alle producten — ${businessInfo.name}`,
    description: "Het volledige Mokka Home Interior assortiment in één overzicht.",
    type: "website",
    url: "/products",
  },
};

interface Props {
  searchParams: Promise<{ category?: string }>;
}

/**
 * /products — overzicht "alle producten" (geen filter).
 *
 * Als ?category=X aanwezig → 301-redirect naar canonieke /<categorie>.
 * Speciale waarde "alle-banken" mapt naar /banken (umbrella).
 */
export default async function ProductsPage({ searchParams }: Props) {
  const { category } = await searchParams;

  if (category) {
    const target = category === "alle-banken" ? "banken" : category;
    if (isCategorySlug(target)) {
      permanentRedirect(`/${target}`);
    }
  }

  // Server-side ophalen → producten staan in de SSR-HTML (SEO + LCP),
  // geen client-fetch + spinner bij eerste load. Filters blijven client-side.
  const initialProducts = await prisma.product.findMany({
    where: { hidden: false, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, name: true, price: true, category: true,
      images: true, featured: true, stock: true, createdAt: true,
      colorGroup: true, colorName: true, colorHex: true, specs: true,
    },
  });

  return (
    <Suspense fallback={
      <div className="pt-28 lg:pt-32 pb-20">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-14 lg:mb-20">
          <div className="h-3 w-24 bg-bone animate-shimmer mb-4" />
          <div className="h-12 w-72 bg-bone animate-shimmer" />
        </div>
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="h-14 bg-bone animate-shimmer mb-10 lg:mb-14" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-12 sm:gap-x-4 sm:gap-y-14">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-square bg-white animate-shimmer" />
                <div className="h-3 w-3/4 bg-bone animate-shimmer" />
                <div className="h-3 w-1/3 bg-bone animate-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <ProductsContent initialProducts={initialProducts} />
    </Suspense>
  );
}
