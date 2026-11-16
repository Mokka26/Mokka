import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_SLUGS = 12;
const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

// Persoonlijke "recent bekeken"-lijst: nooit op de CDN cachen.
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function POST(req: NextRequest) {
  // Publieke DB-query: begrenzen per IP, net als /api/products.
  const rl = await rateLimitIp("api-products-by-slugs", 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Te veel verzoeken. Probeer het zo opnieuw.", products: [] },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = (await req.json().catch(() => null)) as { slugs?: unknown } | null;
  const slugs = Array.isArray(body?.slugs)
    ? Array.from(
        new Set(
          (body.slugs as unknown[]).filter(
            (s): s is string => typeof s === "string" && SLUG_PATTERN.test(s),
          ),
        ),
      ).slice(0, MAX_SLUGS)
    : [];

  if (slugs.length === 0) {
    return NextResponse.json({ products: [] }, { headers: NO_STORE });
  }

  try {
    const products = await prisma.product.findMany({
      where: { slug: { in: slugs }, hidden: false, deletedAt: null },
      // Alleen klant-velden — geen interne `source` e.d. (zie /api/products).
      select: {
        id: true, slug: true, name: true, price: true, listPrice: true,
        category: true, images: true, featured: true, stock: true, createdAt: true,
        colorGroup: true, colorName: true, colorHex: true, sizeName: true, specs: true,
      },
    });

    // Behoud de volgorde van de input slugs (chronologisch — meest recent eerst)
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const ordered = slugs.map((s) => bySlug.get(s)).filter((p) => p != null);

    return NextResponse.json({ products: ordered }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ products: [] }, { status: 503, headers: NO_STORE });
  }
}
