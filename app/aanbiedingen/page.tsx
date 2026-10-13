import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { businessInfo } from "@/lib/business-info";
import { firstImageOnly } from "@/lib/imageHelpers";
import { PRODUCTS_TAG } from "@/lib/revalidate";
import { productUrl } from "@/lib/categories";
import { buildBreadcrumbJsonLd, jsonLdHtml, truncateAtWord, type BreadcrumbItem } from "@/lib/jsonLd";
import { ogDefaults } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";

interface Props {
  searchParams: Promise<{ page?: string | string[] }>;
}

const PATH = "/aanbiedingen";
const PAGE_SIZE = 24;
const TITLE = "Aanbiedingen: meubels en lampen onder de adviesprijs";
const DESCRIPTION = `Alle meubels en lampen die bij ${businessInfo.name} onder de adviesprijs van de fabrikant verkocht worden. De adviesprijs en onze prijs staan bij elk product, incl. btw.`;

// Alleen échte kortingen: adviesprijs (listPrice) hoger dan de verkoopprijs.
const getSaleProducts = unstable_cache(
  async () => {
    const products = await prisma.product.findMany({
      where: {
        hidden: false,
        deletedAt: null,
        price: { gt: 0 },
        listPrice: { gt: prisma.product.fields.price },
      },
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
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    });
    // Grootste korting (in %) eerst; stabiele sort binnen gelijke korting.
    const discount = (p: { price: number; listPrice: number | null }) =>
      p.listPrice ? (p.listPrice - p.price) / p.listPrice : 0;
    return products
      .map((p) => ({ ...p, images: firstImageOnly(p.images) }))
      .sort((a, b) => discount(b) - discount(a));
  },
  ["sale-products"],
  { tags: [PRODUCTS_TAG], revalidate: 3600 },
);

/** Zelfde regels als de categoriepagina: "0"/"1" → redirect naar de basis. */
function parsePage(raw: string | string[] | undefined): number | "redirect" | null {
  if (raw === undefined) return 1;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n <= 1 ? "redirect" : n;
}

function pageUrl(page: number): string {
  return page <= 1 ? PATH : `${PATH}?page=${page}`;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page: rawPage } = await searchParams;
  const parsed = parsePage(rawPage);
  if (parsed === null) return { title: "Pagina niet gevonden", robots: { index: false, follow: false } };
  const page = parsed === "redirect" ? 1 : parsed;
  const products = await getSaleProducts();

  const title = page > 1 ? `Aanbiedingen, pagina ${page}` : TITLE;
  const description = page > 1 ? truncateAtWord(`Pagina ${page}: ${DESCRIPTION}`, 160) : DESCRIPTION;
  const url = pageUrl(page);
  return {
    title,
    description,
    alternates: { canonical: url },
    // Zonder aanbiedingen is dit een lege pagina: niet indexeren, wel volgen.
    robots: products.length === 0 ? { index: false, follow: true } : { index: true, follow: true },
    ...ogDefaults({ title: `${title} | ${businessInfo.name}`, description, url }),
  };
}

export default async function AanbiedingenPage({ searchParams }: Props) {
  const { page: rawPage } = await searchParams;
  const parsed = parsePage(rawPage);
  if (parsed === null) notFound();
  if (parsed === "redirect") permanentRedirect(PATH);
  const page = parsed;

  const products = await getSaleProducts();
  const totalCount = products.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (page > totalPages) notFound();
  const start = (page - 1) * PAGE_SIZE;
  const pageProducts = products.slice(start, start + PAGE_SIZE);
  const prevHref = page > 1 ? pageUrl(page - 1) : null;
  const nextHref = page < totalPages ? pageUrl(page + 1) : null;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: "Home", url: "/" },
    { name: "Aanbiedingen", url: PATH },
  ];
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Aanbiedingen — ${businessInfo.name}`,
    description: DESCRIPTION,
    url: `${businessInfo.siteUrl}${pageUrl(page)}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: totalCount,
      itemListElement: pageProducts.map((p, idx) => ({
        "@type": "ListItem",
        position: start + idx + 1,
        url: `${businessInfo.siteUrl}${productUrl(p)}`,
        name: p.name,
      })),
    },
  };

  return (
    <>
      {prevHref && <link rel="prev" href={prevHref} />}
      {nextHref && <link rel="next" href={nextHref} />}
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
          <h1 className="display-lg text-ink mb-6">
            Aanbiedingen
            {page > 1 && <span className="sr-only"> – pagina {page}</span>}
          </h1>
          <p className="body-lg text-slate max-w-2xl">
            Producten die we onder de adviesprijs verkopen. Je ziet bij elk product de adviesprijs en onze
            prijs, incl. btw.
          </p>
          <p className="mt-4 text-[16px] leading-[1.6] text-graphite max-w-2xl">
            De adviesprijs is de prijs die de fabrikant of leverancier voor het product adviseert. Onze
            prijs is wat je bij ons betaalt; het verschil is de korting. Bekijk ook{" "}
            <Link
              href="/nieuw"
              className="inline-flex items-center min-h-11 text-accent-dark underline underline-offset-2 hover:text-ink focus-visible:text-ink"
            >
              nieuw binnen
            </Link>
            .
          </p>
        </header>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {totalCount === 0 ? (
            <div className="text-center py-32">
              <p className="font-serif text-2xl text-ink mb-4">Op dit moment geen aanbiedingen</p>
              <p className="text-[16px] text-slate">
                Kijk later nog eens, of bekijk wat er{" "}
                <Link href="/nieuw" className="underline underline-offset-2 text-ink hover:text-accent">
                  nieuw binnen
                </Link>{" "}
                is.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] uppercase tracking-[0.2em] text-stone mb-8 px-2">
                {totalCount} {totalCount === 1 ? "product" : "producten"}
                {totalPages > 1 && ` · pagina ${page} van ${totalPages}`}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12">
                {pageProducts.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 2} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav aria-label="Paginering" className="flex items-center justify-between gap-4 mt-14 px-2">
                  {prevHref ? (
                    <Link href={prevHref} className="btn-link">
                      Vorige pagina
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-[15px] text-graphite">
                    Pagina {page} van {totalPages}
                  </span>
                  {nextHref ? (
                    <Link href={nextHref} className="btn-link">
                      Volgende pagina
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
