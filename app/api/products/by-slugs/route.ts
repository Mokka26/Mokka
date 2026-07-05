import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_SLUGS = 12;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { slugs?: unknown } | null;
  const slugs = Array.isArray(body?.slugs)
    ? (body.slugs as unknown[]).filter((s): s is string => typeof s === "string").slice(0, MAX_SLUGS)
    : [];

  if (slugs.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const products = await prisma.product.findMany({
    where: { slug: { in: slugs }, hidden: false, deletedAt: null },
    // Alleen klant-velden — geen interne `source` e.d. (zie /api/products).
    select: {
      id: true, slug: true, name: true, price: true, listPrice: true,
      category: true, images: true, featured: true, stock: true, createdAt: true,
      colorGroup: true, colorName: true, colorHex: true, specs: true,
    },
  });

  // Behoud de volgorde van de input slugs (chronologisch — meest recent eerst)
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const ordered = slugs.map((s) => bySlug.get(s)).filter((p) => p != null);

  return NextResponse.json({ products: ordered });
}
