import { prisma } from "@/lib/prisma";
import { productUrl } from "@/lib/categories";

export type RedirectTarget = {
  slug: string;
  category: string;
  /** Canonieke URL (/<categorie>/<slug>) om naartoe te 308'en. */
  url: string;
};

/**
 * Zoekt een oude product-slug op in de SlugRedirect-tabel en geeft de
 * canonieke URL van het huidige product terug. `null` als er geen redirect
 * is, het product verborgen of verwijderd is, of de categorie geen route
 * heeft (dan zou de redirect zelf weer op een 404 uitkomen).
 */
export async function findRedirectTarget(oldSlug: string): Promise<RedirectTarget | null> {
  const redirect = await prisma.slugRedirect.findUnique({
    where: { oldSlug },
    select: { productId: true },
  });
  if (!redirect) return null;

  const product = await prisma.product.findFirst({
    where: { id: redirect.productId, hidden: false, deletedAt: null },
    select: { slug: true, category: true },
  });
  if (!product || product.slug === oldSlug) return null;

  const url = productUrl(product);
  if (url.startsWith("/products/")) return null;
  return { slug: product.slug, category: product.category, url };
}
