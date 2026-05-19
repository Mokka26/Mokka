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
  return NextResponse.json(
    { counts },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}
