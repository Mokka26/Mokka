import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const grouped = await prisma.product.groupBy({
    by: ["category"],
    where: { hidden: false, deletedAt: null },
    _count: { _all: true },
  });

  const counts: Record<string, number> = { _total: 0 };
  for (const g of grouped) {
    counts[g.category] = g._count._all;
    counts._total += g._count._all;
  }
  // Umbrella: hoekbanken (folder-banken) + bankstellen samen
  counts["alle-banken"] =
    (counts["banken"] ?? 0) + (counts["hoekbanken"] ?? 0) + (counts["bankstellen"] ?? 0);

  return NextResponse.json(
    { counts },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}
