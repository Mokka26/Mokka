import { NextResponse } from "next/server";
import { getProductCounts } from "@/lib/product-counts";

// Dynamisch zodat de Cache-Control-header altijd meegaat; de data zelf komt
// uit unstable_cache (PRODUCTS_TAG) en wordt bij productmutaties ververst.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const counts = await getProductCounts();
    return NextResponse.json(
      { counts },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json(
      { counts: {} },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
