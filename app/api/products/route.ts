import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Public listing-endpoint: korte cache OK (admin-mutaties zijn niet
// kritiek-real-time). s-maxage=60 = CDN cached 60s, stale-while-revalidate
// 300s = klant ziet altijd directe response terwijl achtergrond ververst.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") || "newest";
  const q = searchParams.get("q");
  const minPrice = parseFloat(searchParams.get("minPrice") || "0");
  const maxPrice = parseFloat(searchParams.get("maxPrice") || "99999");

  // includeHidden alleen voor ingelogde admins — anonieme bezoekers mogen
  // verborgen (niet-gepubliceerde) producten nooit zien, ook niet via de query.
  const session = await auth();
  const includeHidden =
    searchParams.get("includeHidden") === "1" && Boolean(session?.user);

  const where: Record<string, unknown> = {};

  // Soft-deleted producten zijn nooit publiek zichtbaar (zitten in prullenbak)
  where.deletedAt = null;

  // Default: alleen niet-verborgen producten tonen
  if (!includeHidden) {
    where.hidden = false;
  }

  if (category === "alle-banken") {
    // Umbrella: alle bank-types samen — hoekbanken (alle folder-banken) + bankstellen
    where.category = { in: ["banken", "hoekbanken", "bankstellen"] };
  } else if (category) {
    where.category = category;
  }

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
    ];
  }

  where.price = {
    gte: minPrice,
    lte: maxPrice,
  };

  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (sort === "price-asc") orderBy = { price: "asc" };
  if (sort === "price-desc") orderBy = { price: "desc" };
  if (sort === "name") orderBy = { name: "asc" };

  const products = await prisma.product.findMany({
    where,
    orderBy,
  });

  return NextResponse.json(
    { products },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
