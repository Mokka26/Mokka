import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, productUrl } from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";
import { GIDS_PATH, GUIDES, guidePath } from "@/app/gids/guides";

export const revalidate = 3600;

// Publicatiedatum van de content-/servicepagina's (bezorging, betalen,
// showroom, gids-overzicht).
const CONTENT_PAGES_UPDATED = "2026-10-12";

const VISIBLE = { hidden: false, deletedAt: null } as const;

/**
 * sitemap.xml:
 *  - statische pagina's
 *  - categorie-pagina's met ≥ 1 zichtbaar product (lastModified = nieuwste update)
 *  - /aanbiedingen en /nieuw als ze producten hebben
 *  - product-pagina's onder hun canonieke /<categorie>/<slug>
 * Geen priority/changeFrequency (Google negeert ze) en geen /products (noindex).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = businessInfo.siteUrl;

  const [perCategory, products, saleCount, newCount] = await Promise.all([
    prisma.product.groupBy({
      by: ["category"],
      where: VISIBLE,
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.product.findMany({
      where: VISIBLE,
      select: { slug: true, category: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.product.count({
      where: { ...VISIBLE, price: { gt: 0 }, listPrice: { gt: prisma.product.fields.price } },
    }),
    prisma.product.count({ where: { ...VISIBLE, price: { gt: 0 } } }),
  ]);

  const stats = new Map(perCategory.map((row) => [row.category, row]));

  // Content- en servicepagina's (app/bezorging, /betalen, /showroom, /gids):
  // lastModified = publicatiedatum van de huidige tekst; bijwerken bij een
  // inhoudelijke wijziging. De gidsen zelf komen uit app/gids/guides.ts.
  const contentLastModified = new Date(CONTENT_PAGES_UPDATED);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/` },
    { url: `${baseUrl}/about` },
    { url: `${baseUrl}/contact` },
    { url: `${baseUrl}/retourneren` },
    { url: `${baseUrl}/privacy` },
    { url: `${baseUrl}/algemene-voorwaarden` },
    { url: `${baseUrl}/cookies` },
    { url: `${baseUrl}/bezorging`, lastModified: contentLastModified },
    { url: `${baseUrl}/betalen`, lastModified: contentLastModified },
    { url: `${baseUrl}/showroom`, lastModified: contentLastModified },
    { url: `${baseUrl}${GIDS_PATH}`, lastModified: contentLastModified },
    ...GUIDES.map((g) => ({ url: `${baseUrl}${guidePath(g.slug)}`, lastModified: new Date(g.dateModified) })),
  ];

  const categoryRoutes: MetadataRoute.Sitemap = [];
  for (const c of CATEGORIES) {
    let count = 0;
    let lastModified: Date | undefined;
    for (const db of c.dbCategories) {
      const row = stats.get(db);
      if (!row) continue;
      count += row._count._all;
      const max = row._max.updatedAt;
      if (max && (!lastModified || max > lastModified)) lastModified = max;
    }
    if (count === 0) continue;
    categoryRoutes.push({ url: `${baseUrl}/${c.slug}`, lastModified });
  }

  const collectionRoutes: MetadataRoute.Sitemap = [];
  const newest = products[0]?.updatedAt;
  if (saleCount > 0) collectionRoutes.push({ url: `${baseUrl}/aanbiedingen`, lastModified: newest });
  if (newCount > 0) collectionRoutes.push({ url: `${baseUrl}/nieuw`, lastModified: newest });

  const productRoutes: MetadataRoute.Sitemap = [];
  for (const p of products) {
    const path = productUrl(p);
    // Categorie zonder route → geen canonieke pagina → niet in de sitemap.
    if (path.startsWith("/products/")) continue;
    productRoutes.push({ url: `${baseUrl}${path}`, lastModified: p.updatedAt });
  }

  return [...staticRoutes, ...categoryRoutes, ...collectionRoutes, ...productRoutes];
}
