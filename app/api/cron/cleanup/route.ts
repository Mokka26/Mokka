import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";
import { captureError } from "@/lib/sentry";

// Dagelijkse opruiming (zie vercel.json):
//   - RateLimit-rijen waarvan het venster verstreken is;
//   - nieuwsbrief-aanmeldingen die na 7 dagen niet bevestigd zijn (alleen
//     rijen uit de double-opt-in-flow — legacy-aanmeldingen zonder token
//     blijven staan, die golden als bevestigd).
// Beveiliging: Authorization: Bearer <CRON_SECRET> (lib/cron-auth.ts).

export const dynamic = "force-dynamic";

const UNCONFIRMED_DAYS = 7;

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - UNCONFIRMED_DAYS * 24 * 60 * 60 * 1000);
    const [rateLimits, subscribers] = await Promise.all([
      prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }),
      prisma.newsletterSubscriber.deleteMany({
        where: { confirmedAt: null, confirmToken: { not: null }, createdAt: { lt: cutoff } },
      }),
    ]);
    return NextResponse.json({ ok: true, rateLimitsDeleted: rateLimits.count, unconfirmedSubscribersDeleted: subscribers.count });
  } catch (e) {
    captureError(e, { scope: "cron.cleanup" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// Vercel-cron roept endpoints via GET aan → dezelfde (beveiligde) handler.
export const GET = POST;
