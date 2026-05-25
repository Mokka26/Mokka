import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, dbCategoryToRouteSlug } from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";

/**
 * Genereert sitemap.xml met:
 *  - Statische pagina's (home, about, contact, lookbook)
 *  - Categorie-pagina's (15)
 *  - Product-pagina's onder hun canonieke /<categorie>/<slug>
 *
 * Admin en API routes worden geblokkeerd in robots.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = businessInfo.siteUrl;

  // Statische pagina's
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/lookbook`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/products`, changeFrequency: "daily", priority: 0.5 },
    { url: `${baseUrl}/retourneren`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/algemene-voorwaarden`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Categorie-pagina's
  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${baseUrl}/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: c.isUmbrella ? 0.7 : 0.8,
  }));

  // Product-pagina's (alleen zichtbare, niet-verwijderde)
  const products = await prisma.product.findMany({
    where: { hidden: false, deletedAt: null },
    select: { slug: true, category: true, updatedAt: true },
  });

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/${dbCategoryToRouteSlug(p.category)}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
