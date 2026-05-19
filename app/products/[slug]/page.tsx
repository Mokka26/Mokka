import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, deletedAt: null },
  });

  if (!product) return { title: "Product Niet Gevonden" };

  return {
    title: `${product.name} — Mokka Home Interior`,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, deletedAt: null },
  });

  if (!product) notFound();

  const [relatedProducts, colorVariants] = await Promise.all([
    prisma.product.findMany({
      where: {
        category: product.category,
        id: { not: product.id },
        deletedAt: null,
        hidden: false,
      },
      take: 4,
    }),
    product.colorGroup
      ? prisma.product.findMany({
          where: { colorGroup: product.colorGroup, deletedAt: null },
          select: { id: true, slug: true, colorName: true, colorHex: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <ProductDetailClient
      product={product}
      relatedProducts={relatedProducts}
      colorVariants={colorVariants}
    />
  );
}
