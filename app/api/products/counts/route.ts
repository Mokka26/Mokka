import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  return NextResponse.json({ counts });
}
