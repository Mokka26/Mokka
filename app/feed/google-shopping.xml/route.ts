import { prisma } from "@/lib/prisma";
import { buildFeedDocument, FEED_PRODUCT_SELECT } from "@/lib/google-shopping";

// Google Merchant Center-productfeed. Merchant Center haalt deze URL
// dagelijks op (Producten → Databronnen → Geplande ophaalactie). Statisch
// gecachet en elk uur opnieuw gegenereerd; prijs- en voorraadwijzigingen
// staan dus binnen een uur in de feed.
//
// Alleen zichtbare, niet-verwijderde producten met voorraad (> 0) en een prijs
// (> 0; maatvarianten op variantprijs). Uitverkochte producten staan er niet in
// (geen `out_of_stock`-items). Zie docs/google-shopping.md.
export const revalidate = 3600;

export async function GET() {
  const products = await prisma.product.findMany({
    where: { hidden: false, deletedAt: null, stock: { gt: 0 } },
    select: FEED_PRODUCT_SELECT,
    orderBy: { createdAt: "desc" },
  });

  const { xml, itemCount } = buildFeedDocument(products);
  const body = new TextEncoder().encode(xml);

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Feed-Items": String(itemCount),
    },
  });
}
