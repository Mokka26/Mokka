import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") || "newest";
  const q = searchParams.get("q");
  const minPrice = parseFloat(searchParams.get("minPrice") || "0");
  const maxPrice = parseFloat(searchParams.get("maxPrice") || "99999");

  const includeHidden = searchParams.get("includeHidden") === "1";

  const where: Record<string, unknown> = {};

  // Soft-deleted producten zijn nooit publiek zichtbaar (zitten in prullenbak)
  where.deletedAt = null;

  // Default: alleen niet-verborgen producten tonen
  if (!includeHidden) {
    where.hidden = false;
  }

  if (category === "alle-banken") {
    // Umbrella: standaard banken + Loungebanken + hoekbanken + U-Banken
    where.category = { in: ["banken", "hoekbanken"] };
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
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}
