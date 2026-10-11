import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProductDetailClient from "@/app/products/[slug]/ProductDetailClient";
import { dbCategoryToRouteSlug } from "@/lib/categories";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Admin-voorbeeld van een productpagina — ook voor VERBORGEN producten.
 *
 * De publieke PDP (/<categorie>/<slug>) geeft verborgen producten bewust een
 * harde 404 en blijft daardoor statisch gecached. Dit is de enige plek waar
 * een beheerder een nog niet gepubliceerd product kan bekijken zoals het live
 * zou staan. Route valt onder /admin → proxy.ts eist een ingelogde sessie.
 */
export const metadata: Metadata = {
  title: "Admin-voorbeeld · Mokka Home Interior",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminProductPreview({ params }: Props) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/admin/login?from=${encodeURIComponent(`/admin/preview/${slug}`)}`);

  const product = await prisma.product.findFirst({ where: { slug, deletedAt: null } });
  if (!product) notFound();

  // Zelfde bijvangst als de publieke PDP, zodat het voorbeeld er identiek uitziet.
  const [relatedProducts, colorVariants] = await Promise.all([
    prisma.product.findMany({
      where: { category: product.category, id: { not: product.id }, hidden: false, deletedAt: null },
      take: 4,
      select: {
        id: true, slug: true, name: true, price: true, listPrice: true, description: true,
        category: true, images: true, featured: true, stock: true, createdAt: true,
        colorGroup: true, colorName: true, colorHex: true, specs: true,
      },
    }),
    product.colorGroup
      ? prisma.product.findMany({
          where: { colorGroup: product.colorGroup, deletedAt: null },
          select: { id: true, slug: true, colorName: true, colorHex: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const liveUrl = `/${dbCategoryToRouteSlug(product.category)}/${product.slug}`;
  const linkClass =
    "underline underline-offset-4 hover:text-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light";

  return (
    <>
      <div role="status" className="bg-ink text-paper text-base leading-relaxed px-4 py-3 sm:px-6">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p>
            <strong className="font-semibold">Admin-voorbeeld.</strong>{" "}
            {product.hidden
              ? "Dit product is verborgen: klanten krijgen een 404 totdat je het publiceert."
              : "Dit product staat live."}
            {product.price <= 0 && " Er is nog geen prijs ingevoerd."}
          </p>
          <nav aria-label="Voorbeeld-acties" className="flex gap-6">
            <Link href={`/admin/products/${product.slug}`} className={linkClass}>
              Bewerken
            </Link>
            {!product.hidden && (
              <Link href={liveUrl} className={linkClass}>
                Live bekijken
              </Link>
            )}
          </nav>
        </div>
      </div>
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
        colorVariants={colorVariants}
      />
    </>
  );
}
