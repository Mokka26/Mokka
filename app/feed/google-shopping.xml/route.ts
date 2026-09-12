import { prisma } from "@/lib/prisma";
import { buildFeed, FEED_PRODUCT_SELECT } from "@/lib/google-shopping";

// Google Merchant Center-productfeed. Merchant Center haalt deze URL
// dagelijks op (Producten → Databronnen → Geplande ophaalactie). Statisch
// gecachet en elk uur opnieuw gegenereerd; prijs- en voorraadwijzigingen
// staan dus binnen een uur in de feed.
export const revalidate = 3600;

export async function GET() {
  const products = await prisma.product.findMany({
    where: { hidden: false, deletedAt: null },
    select: FEED_PRODUCT_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return new Response(buildFeed(products), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
