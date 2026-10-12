import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { reconcileOpenOrders, resendPendingConfirmations } from "@/lib/order-sync";
import { captureError } from "@/lib/sentry";

// Vangnet voor de betaalflow (elke 15 min via Vercel Cron, zie vercel.json):
//   1. open orders mét Mollie-betaling ouder dan 15 min opnieuw syncen
//      (gemiste/mislukte webhook), orders zonder betaling na 24 u → expired;
//   2. betaalde orders zonder verstuurde bevestiging alsnog mailen.
// Beveiliging: Authorization: Bearer <CRON_SECRET> (lib/cron-auth.ts).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const reconcile = await reconcileOpenOrders(15);
    const confirmations = await resendPendingConfirmations();
    return NextResponse.json({ ok: true, reconcile, confirmations });
  } catch (e) {
    captureError(e, { scope: "cron.reconcileOrders" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// Vercel-cron roept endpoints via GET aan → dezelfde (beveiligde) handler.
export const GET = POST;
