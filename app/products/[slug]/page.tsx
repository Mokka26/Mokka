import { permanentRedirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dbCategoryToRouteSlug } from "@/lib/categories";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Legacy-route: /products/<slug>
 *
 * Sinds Layer 2 zijn product-pagina's verhuisd naar /<categorie>/<slug>.
 * Deze pagina blijft bestaan om externe links + bookmarks te ondersteunen;
 * 301-redirect naar de canonieke URL.
 */
export default async function LegacyProductRedirect({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, hidden: false, deletedAt: null },
    select: { slug: true, category: true },
  });

  if (!product) notFound();

  permanentRedirect(`/${dbCategoryToRouteSlug(product.category)}/${product.slug}`);
}
