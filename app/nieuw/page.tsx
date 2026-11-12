import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { businessInfo } from "@/lib/business-info";
import { firstImageOnly } from "@/lib/imageHelpers";
import { PRODUCTS_TAG } from "@/lib/revalidate";
import { productUrl } from "@/lib/categories";
import { buildBreadcrumbJsonLd, jsonLdHtml, type BreadcrumbItem } from "@/lib/jsonLd";
import { ogDefaults } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import { ProductGrid } from "@/components/ProductGrid";
import { dedupeByColorGroup } from "@/lib/dedupe";

const PATH = "/nieuw";
const LIMIT = 48;
const TITLE = "Nieuw in de collectie: de laatste meubels";
const DESCRIPTION = `De ${LIMIT} nieuwste producten bij ${businessInfo.name}: banken, tafels, stoelen, kasten, bedden en verlichting die recent aan de collectie zijn toegevoegd. Prijzen incl. btw.`;

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
        sizeName: true,
        specs: true,
      },
      orderBy: { createdAt: "desc" },
      // Ruim ophalen: na het samenvoegen per model (maten/kleuren) blijven er
      // minder kaarten over.
      take: LIMIT * 3,
    });
    return dedupeByColorGroup(products.map((p) => ({ ...p, images: firstImageOnly(p.images) }))).slice(0, LIMIT);
  },
  ["new-products"],
  { tags: [PRODUCTS_TAG], revalidate: 3600 },
);

export async function generateMetadata(): Promise<Metadata> {
  const products = await getNewProducts();
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: PATH },
    // Zonder producten is dit een lege pagina: niet indexeren, wel volgen.
    robots: products.length === 0 ? { index: false, follow: true } : { index: true, follow: true },
    ...ogDefaults({ title: `${TITLE} | ${businessInfo.name}`, description: DESCRIPTION, url: PATH }),
  };
}

export default async function NieuwPage() {
  const products = await getNewProducts();

  const breadcrumbs: BreadcrumbItem[] = [
    { name: "Home", url: "/" },
    { name: "Nieuw", url: PATH },
  ];
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Nieuw — ${businessInfo.name}`,
    description: DESCRIPTION,
    url: `${businessInfo.siteUrl}${PATH}`,
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
        <header className="max-w-page mx-auto px-6 sm:px-10 lg:px-14 mb-10 lg:mb-14">
          <Breadcrumbs items={breadcrumbs} className="mb-6" />
          <p className="eyebrow mb-4">Collectie</p>
          <h1 className="display-lg text-ink mb-6">Nieuw</h1>
          <p className="body-lg text-slate max-w-2xl">
            De laatste producten die aan de collectie zijn toegevoegd, nieuwste eerst. Bekijk ook de{" "}
            <Link
              href="/aanbiedingen"
              className="inline-flex items-center min-h-11 text-accent-dark underline underline-offset-2 hover:text-ink focus-visible:text-ink"
            >
              aanbiedingen
            </Link>
            .
          </p>
        </header>

        <div className="max-w-page mx-auto px-6 sm:px-10 lg:px-14">
          {products.length === 0 ? (
            <div className="text-center py-32">
              <p className="font-serif text-2xl text-ink mb-4">Nog geen producten</p>
              <p className="text-[16px] text-slate">
                Bekijk de{" "}
                <Link href="/banken" className="underline underline-offset-2 text-ink hover:text-accent-dark">
                  banken
                </Link>{" "}
                of de categorieën via het menu.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] uppercase tracking-label text-stone mb-8 px-2">
                {products.length} {products.length === 1 ? "product" : "producten"}
              </p>
              <h2 className="sr-only">Nieuwe producten</h2>
              <ProductGrid>
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} variants={p.variants} priority={i < 2} />
                ))}
              </ProductGrid>
            </>
          )}
        </div>
      </div>
    </>
  );
}
