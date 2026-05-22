import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Vercel cron pingt deze elke 5 min om Neon (auto-suspend na ~5 min idle)
// wakker te houden. Voorkomt cold-start van 3-10s bij eerste user-request.
//
// Gebruikt $queryRaw met een no-op SELECT zodat Prisma geen schema cache mist;
// een echte SELECT 1 dwingt een DB-roundtrip af.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      ms: Date.now() - t0,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        ms: Date.now() - t0,
      },
      { status: 500 },
    );
  }
}
