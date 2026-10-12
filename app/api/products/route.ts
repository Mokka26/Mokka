import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { firstImageOnly } from "@/lib/imageHelpers";

// Public listing-endpoint: korte cache OK (admin-mutaties zijn niet
// kritiek-real-time). s-maxage=60 = CDN cached 60s, stale-while-revalidate
// 300s = klant ziet altijd directe response terwijl achtergrond ververst.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") || "newest";
  // Begrens de zoekterm: een ongelimiteerde `contains`-scan op niet-geïndexeerde
  // kolommen is een goedkope manier om de DB te belasten.
  const q = searchParams.get("q")?.slice(0, 80) || null;
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
    // insensitive: Postgres 'contains' is standaard hoofdlettergevoelig —
    // "vanilla" zou "Vanilla Loop" anders niet vinden.
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
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

  // Expliciete select: alleen klant-velden. NOOIT interne kolommen als `source`
  // (groothandel-/dropship-leverancier) publiek teruggeven.
  const rows = await prisma.product.findMany({
    where,
    orderBy,
    take: 1000,
    select: {
      id: true, slug: true, name: true, price: true, listPrice: true,
      category: true, images: true, featured: true, stock: true, createdAt: true,
      colorGroup: true, colorName: true, colorHex: true, specs: true,
    },
  });
  // Payload-trim: de listing-kaart toont alleen foto 1 — bij take:1000 scheelt
  // het weglaten van de overige image-URL's ~80% response-grootte.
  const products = rows.map((p) => ({ ...p, images: firstImageOnly(p.images) }));

  // Admin-respons (met verborgen producten) mag NOOIT in een gedeelde cache
  // (CDN) belanden en daarna aan anonieme bezoekers worden geserveerd.
  const headers: Record<string, string> = includeHidden
    ? { "Cache-Control": "private, no-store", Vary: "Cookie" }
    : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  return NextResponse.json({ products }, { headers });
}
