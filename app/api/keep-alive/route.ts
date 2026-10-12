import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";
import { captureError } from "@/lib/sentry";

// Vercel cron pingt deze elke 10 min om Neon (auto-suspend na ~5 min idle)
// wakker te houden. Voorkomt cold-start van 3-10s bij eerste user-request.
//
// Alleen voor de cron (Bearer CRON_SECRET): anoniem kon iedereen hiermee
// onbeperkt DB-roundtrips afdwingen. De respons is generiek — geen
// foutmeldingen of timings naar buiten (die staan in Sentry).

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    captureError(err, { scope: "keepAlive" });
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
}
