import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { PRODUCTS_TAG } from "@/lib/revalidate";

export type ProductCounts = Record<string, number>;

/**
 * Zichtbare producten per DB-categorie, plus per umbrella-slug (banken, kasten,
 * verlichting, …) de som van zijn DB-categorieën en `_total`. Gecachet op
 * PRODUCTS_TAG: één query per 5 minuten of tot een productmutatie
 * `revalidateProduct()` aanroept. Gedeeld door de homepage (CategoriesGrid)
 * en /api/products/counts (FilterBar).
 */
export const getProductCounts = unstable_cache(
  async (): Promise<ProductCounts> => {
    const grouped = await prisma.product.groupBy({
      by: ["category"],
      where: { hidden: false, deletedAt: null },
      _count: { _all: true },
    });

    const counts: ProductCounts = { _total: 0 };
    for (const g of grouped) {
      counts[g.category] = g._count._all;
      counts._total += g._count._all;
    }
    for (const c of CATEGORIES) {
      if (!c.isUmbrella) continue;
      counts[c.slug] = c.dbCategories.reduce((sum, db) => sum + (counts[db] ?? 0), 0);
    }
    // Legacy-sleutel voor de FilterBar ("alle-banken" = umbrella banken).
    counts["alle-banken"] = counts["banken"] ?? 0;
    return counts;
  },
  ["product-counts"],
  { tags: [PRODUCTS_TAG], revalidate: 300 },
);
