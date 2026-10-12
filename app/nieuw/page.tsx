import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { businessInfo } from "@/lib/business-info";
import { firstImageOnly } from "@/lib/imageHelpers";
import { PRODUCTS_TAG } from "@/lib/revalidate";
import { productUrl } from "@/lib/categories";
import { buildBreadcrumbJsonLd, jsonLdHtml, type BreadcrumbItem } from "@/lib/jsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";

export const revalidate = 3600;

const LIMIT = 48;
const TITLE = "Nieuw in de collectie: de laatste meubels";
const DESCRIPTION = `De ${LIMIT} nieuwste producten bij ${businessInfo.name}: banken, tafels, stoelen, kasten, bedden en verlichting die recent aan de collectie zijn toegevoegd. Prijzen incl. btw.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/nieuw" },
  openGraph: {
    title: `${TITLE} | ${businessInfo.name}`,
    description: DESCRIPTION,
    type: "website",
    url: "/nieuw",
    locale: "nl_NL",
  },
};

const getNewProducts = unstable_cache(
  async () => {
    const products = await prisma.product.findMany({
      where: { hidden: false, deletedAt: null, price: { gt: 0 } },
      select: {
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
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    });
    return products.map((p) => ({ ...p, images: firstImageOnly(p.images) }));
  },
  ["new-products"],
  { tags: [PRODUCTS_TAG], revalidate: 3600 },
);

export default async function NieuwPage() {
  const products = await getNewProducts();

  const breadcrumbs: BreadcrumbItem[] = [
    { name: "Home", url: "/" },
    { name: "Nieuw", url: "/nieuw" },
  ];
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Nieuw — ${businessInfo.name}`,
    description: DESCRIPTION,
    url: `${businessInfo.siteUrl}/nieuw`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 24).map((p, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${businessInfo.siteUrl}${productUrl(p)}`,
        name: p.name,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(buildBreadcrumbJsonLd(breadcrumbs)) }}
      />
      <div className="pt-28 lg:pt-32 pb-20 lg:pb-28">
        <header className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-10 lg:mb-14">
          <Breadcrumbs items={breadcrumbs} className="mb-6" />
          <p className="eyebrow mb-4">Collectie</p>
          <h1 className="display-lg text-ink mb-6">Nieuw</h1>
          <p className="body-lg text-slate max-w-2xl">
            De laatste producten die aan de collectie zijn toegevoegd, nieuwste eerst.
          </p>
        </header>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {products.length === 0 ? (
            <div className="text-center py-32">
              <p className="font-serif text-2xl text-ink mb-4">Nog geen producten</p>
              <p className="text-[16px] text-slate">Bekijk de categorieën via het menu.</p>
            </div>
          ) : (
            <>
              <p className="text-[13px] uppercase tracking-[0.2em] text-stone mb-8 px-2">
                {products.length} {products.length === 1 ? "product" : "producten"}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 2} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
