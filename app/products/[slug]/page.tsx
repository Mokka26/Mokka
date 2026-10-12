import type { Metadata } from "next";
import { permanentRedirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { productUrl } from "@/lib/categories";
import { findRedirectTarget } from "@/lib/slug-redirect";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Legacy-route: /products/<slug>
 *
 * Product-pagina's leven op /<categorie>/<slug>. Deze route blijft bestaan voor
 * externe links en bookmarks en doet een 308 naar de canonieke URL. Een
 * onbekende slug wordt nog in de SlugRedirect-tabel opgezocht (hernoemde
 * producten); anders een echte 404. Geen loading.tsx op dit segment: een
 * Suspense-boundary zou de status al op 200 zetten vóór de redirect.
 */
export default async function LegacyProductRedirect({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, hidden: false, deletedAt: null },
    select: { slug: true, category: true },
  });

  if (product) {
    const url = productUrl(product);
    // Categorie zonder route → productUrl valt terug op deze legacy-route;
    // dan is er geen canonieke pagina en blijft het een 404 (geen lus).
    if (!url.startsWith("/products/")) permanentRedirect(url);
    notFound();
  }

  const target = await findRedirectTarget(slug);
  if (target) permanentRedirect(target.url);
  notFound();
}
