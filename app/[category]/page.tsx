import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCategory, isCategorySlug, productUrl, type Category } from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";
import { firstImageOnly } from "@/lib/imageHelpers";
import {
  buildBreadcrumbJsonLd,
  buildDescription,
  buildFaqJsonLd,
  jsonLdHtml,
  type BreadcrumbItem,
} from "@/lib/jsonLd";
import { PRODUCTS_TAG } from "@/lib/revalidate";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import CategoryListing, { type ListingProduct, type ListingVariant } from "./CategoryListing";

interface Props {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

const PAGE_SIZE = 24;

// De route leest `?page=` en is daardoor per request dynamisch. De catalogus-
// query zelf is 1 uur gecached (tag "products" → vervalt bij elke mutatie via
// lib/revalidate.ts), dus Neon wordt hooguit 1×/uur per categorie geraakt.
const getCategoryProducts = unstable_cache(
  async (dbCategories: string[]) => {
    const products = await prisma.product.findMany({
      where: { category: { in: dbCategories }, hidden: false, deletedAt: null },
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
    // Payload-trim: de kaart toont alleen foto 1.
    return products.map((p) => ({ ...p, images: firstImageOnly(p.images) }));
  },
  ["category-products"],
  { tags: [PRODUCTS_TAG], revalidate: 3600 },
);

type CategoryProduct = Awaited<ReturnType<typeof getCategoryProducts>>[number];

/** Umbrella-volgorde (bv. banken → hoekbanken eerst); stabiele sort. */
function applyTypeOrder(products: CategoryProduct[], category: Category): CategoryProduct[] {
  const order = category.typeOrder;
  if (!order) return products;
  const rank = (c: string) => {
    const i = order.indexOf(c);
    return i === -1 ? order.length : i;
  };
  return [...products].sort((a, b) => rank(a.category) - rank(b.category));
}

/**
 * Kleurvarianten (zelfde colorGroup) tellen als één kaart. Representant =
 * eerste op voorraad, anders de eerste in volgorde. Geeft ook de swatch-rij
 * per groep terug, zodat de kaart de andere kleuren kan tonen.
 */
function collapseColorGroups(products: CategoryProduct[]): {
  collapsed: CategoryProduct[];
  variants: Record<string, ListingVariant[]>;
} {
  const representative = new Map<string, CategoryProduct>();
  const variants: Record<string, ListingVariant[]> = {};
  for (const p of products) {
    if (!p.colorGroup) continue;
    (variants[p.colorGroup] ??= []).push({ slug: p.slug, colorName: p.colorName, colorHex: p.colorHex });
    const cur = representative.get(p.colorGroup);
    if (!cur || (p.stock > 0 && cur.stock === 0)) representative.set(p.colorGroup, p);
  }
  const collapsed = products.filter((p) => !p.colorGroup || representative.get(p.colorGroup) === p);
  return { collapsed, variants };
}

function parsePage(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 ? n : null;
}

function pageUrl(slug: string, page: number): string {
  return page <= 1 ? `/${slug}` : `/${slug}?page=${page}`;
}

function categoryDescription(category: Category): string {
  if (category.metaDescription) return category.metaDescription;
  return buildDescription(
    category.seoIntro ?? category.intro,
    `Bekijk alle ${category.label.toLowerCase()} van ${businessInfo.name}, prijzen incl. btw, te zien in onze showroom in ${businessInfo.address.city}.`,
  );
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ category: categorySlug }, { page: rawPage }] = await Promise.all([params, searchParams]);
  const category = getCategory(categorySlug);
  const page = parsePage(rawPage);
  if (!category || page === null) {
    return { title: "Categorie niet gevonden", robots: { index: false, follow: false } };
  }

  const url = pageUrl(category.slug, page);
  const title = page > 1 ? `${category.label} kopen – pagina ${page}` : `${category.label} kopen`;
  const description = categoryDescription(category);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${category.label} kopen | ${businessInfo.name}`,
      description,
      type: "website",
      url,
      locale: "nl_NL",
    },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ category: categorySlug }, { page: rawPage }] = await Promise.all([params, searchParams]);

  // Validatie + data VÓÓR de render: notFound() zet dan echt een 404.
  if (!isCategorySlug(categorySlug)) notFound();
  const category = getCategory(categorySlug);
  if (!category) notFound();
  const page = parsePage(rawPage);
  if (page === null) notFound();

  const all = applyTypeOrder(await getCategoryProducts([...category.dbCategories]), category);
  const { collapsed, variants } = collapseColorGroups(all);

  const totalCount = collapsed.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (page > totalPages) notFound();

  const start = (page - 1) * PAGE_SIZE;
  const pageProducts: ListingProduct[] = collapsed.slice(start, start + PAGE_SIZE);
  const pageVariants: Record<string, ListingVariant[]> = {};
  for (const p of pageProducts) {
    if (p.colorGroup && variants[p.colorGroup]) pageVariants[p.colorGroup] = variants[p.colorGroup];
  }

  // Umbrella: subcategorieën met aantal zichtbare producten (alleen die met ≥1).
  const subcategories = category.isUmbrella ? buildSubcategoryLinks(category, all) : [];

  const breadcrumbs: BreadcrumbItem[] = [
    { name: "Home", url: "/" },
    { name: category.label, url: `/${category.slug}` },
  ];

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.label} — ${businessInfo.name}`,
    description: categoryDescription(category),
    url: `${businessInfo.siteUrl}${pageUrl(category.slug, page)}`,
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

  const prevHref = page > 1 ? pageUrl(category.slug, page - 1) : null;
  const nextHref = page < totalPages ? pageUrl(category.slug, page + 1) : null;

  return (
    <>
      {/* React 19 hoist <link> naar <head>; de Metadata-API kent geen prev/next. */}
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
      {category.faq && category.faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(buildFaqJsonLd(category.faq)) }}
        />
      )}

      <div className="pt-28 lg:pt-32 pb-20 lg:pb-28">
        <header className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-6 sm:mb-8 lg:mb-12">
          <Breadcrumbs items={breadcrumbs} className="mb-6" />
          <p className="eyebrow mb-4">Collectie</p>
          <h1 className="display-lg text-ink mb-6">
            {category.label}
            {page > 1 && <span className="sr-only"> – pagina {page}</span>}
          </h1>
          <p className="body-lg text-slate max-w-2xl">{category.intro}</p>
        </header>

        {subcategories.length > 0 && (
          <nav
            aria-label={`Subcategorieën van ${category.label.toLowerCase()}`}
            className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-10 lg:mb-14"
          >
            <ul className="flex flex-wrap gap-3">
              {subcategories.map((sub) => (
                <li key={sub.slug}>
                  <Link
                    href={`/${sub.slug}`}
                    className="inline-flex items-center min-h-11 px-4 border border-line bg-white text-ink text-[15px] hover:border-ink focus-visible:border-ink transition-colors"
                  >
                    {sub.label}
                    <span className="ml-2 text-stone text-[13px]">({sub.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <CategoryListing
          category={category}
          products={pageProducts}
          variants={pageVariants}
          page={page}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          totalCount={totalCount}
          prevHref={prevHref}
          nextHref={nextHref}
        />

        {(category.seoIntro || (category.faq && category.faq.length > 0)) && (
          <section className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mt-20 lg:mt-28">
            <div className="max-w-3xl">
              {category.seoIntro && (
                <>
                  <h2 className="display-sm text-ink mb-5">Over {category.label.toLowerCase()}</h2>
                  <p className="body-lg text-graphite">{category.seoIntro}</p>
                </>
              )}
              {category.faq && category.faq.length > 0 && (
                <div className="mt-12">
                  <h2 className="display-sm text-ink mb-5">Veelgestelde vragen</h2>
                  <div className="divide-y divide-line border-y border-line">
                    {category.faq.map((item) => (
                      <details key={item.q} className="group py-1">
                        <summary className="flex items-center justify-between gap-6 min-h-12 py-3 cursor-pointer text-ink text-[17px] font-medium list-none [&::-webkit-details-marker]:hidden hover:text-accent focus-visible:text-accent">
                          <span>{item.q}</span>
                          <span aria-hidden="true" className="text-stone text-xl leading-none group-open:rotate-45 transition-transform">
                            +
                          </span>
                        </summary>
                        <p className="pb-5 pr-10 text-graphite body-lg">{item.a}</p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function buildSubcategoryLinks(
  category: Category,
  products: ReadonlyArray<{ category: string }>,
): Array<{ slug: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const out: Array<{ slug: string; label: string; count: number }> = [];
  for (const dbCategory of category.dbCategories) {
    if (dbCategory === category.slug) continue;
    const sub = getCategory(dbCategory);
    const count = counts.get(dbCategory) ?? 0;
    if (!sub || count === 0) continue;
    out.push({ slug: sub.slug, label: sub.label, count });
  }
  return out;
}
