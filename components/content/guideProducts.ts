import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { firstImageOnly } from "@/lib/imageHelpers";
import { PRODUCTS_TAG } from "@/lib/revalidate";
import type { ProductCardProduct } from "@/components/ProductCard";

const DEFAULT_LIMIT = 4;

/**
 * Producten voor de productsectie onder een gids: zichtbaar, geprijsd en op
 * voorraad, uitgelichte producten eerst, daarna nieuwste. Gecached op de
 * gedeelde producttag zodat admin-mutaties de gidsen mee verversen.
 */
export async function getGuideProducts(
  dbCategories: ReadonlyArray<string>,
  limit = DEFAULT_LIMIT,
): Promise<ProductCardProduct[]> {
  const categories = [...dbCategories].sort();
  const cached = unstable_cache(
    async () => {
      const products = await prisma.product.findMany({
        where: {
          hidden: false,
          deletedAt: null,
          price: { gt: 0 },
          stock: { gt: 0 },
          category: { in: categories },
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
        take: limit,
      });
      return products.map((p) => ({ ...p, images: firstImageOnly(p.images) }));
    },
    ["guide-products", categories.join(","), String(limit)],
    { tags: [PRODUCTS_TAG], revalidate: 3600 },
  );
  return cached();
}
