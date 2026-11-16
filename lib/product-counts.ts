import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { PRODUCTS_TAG } from "@/lib/revalidate";
import { countModels, type ModelCountRow } from "@/lib/model-count";

export type ProductCounts = Record<string, number>;

/**
 * Zichtbare modellen per DB-categorie, plus per umbrella-slug (banken, kasten,
 * verlichting, …) en `_total`. Geteld zoals de categorielijst ze toont:
 * kleur-/maatvarianten met dezelfde colorGroup zijn één model (countModels),
 * zodat "Eettafels 100" op de homepage hetzelfde zegt als op /eettafels. Gecachet op
 * PRODUCTS_TAG: één query per 5 minuten of tot een productmutatie
 * `revalidateProduct()` aanroept. Gedeeld door de root-layout (lege
 * categorieën uit het menu), de homepage (CategoriesGrid, RoomStory).
 */
export const getProductCounts = unstable_cache(
  async (): Promise<ProductCounts> => {
    const grouped = await prisma.product.groupBy({
      by: ["category", "colorGroup"],
      where: { hidden: false, deletedAt: null },
      _count: { _all: true },
    });

    const rowsByCategory = new Map<string, ModelCountRow[]>();
    const allRows: ModelCountRow[] = [];
    for (const g of grouped) {
      const row = { colorGroup: g.colorGroup, count: g._count._all };
      allRows.push(row);
      const list = rowsByCategory.get(g.category);
      if (list) list.push(row);
      else rowsByCategory.set(g.category, [row]);
    }

    const counts: ProductCounts = { _total: countModels(allRows) };
    for (const [category, rows] of rowsByCategory) counts[category] = countModels(rows);
    // Umbrella: één model dat in twee subcategorieën valt telt één keer.
    for (const c of CATEGORIES) {
      if (!c.isUmbrella) continue;
      counts[c.slug] = countModels(c.dbCategories.flatMap((db) => rowsByCategory.get(db) ?? []));
    }
    return counts;
  },
  ["product-counts"],
  { tags: [PRODUCTS_TAG], revalidate: 300 },
);
