import { NextRequest, NextResponse } from "next/server";
import { syncOrderByPaymentId } from "@/lib/order-sync";
import { isMollieNotFound } from "@/lib/mollie";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// Mollie roept deze webhook aan met een form-body { id: "<payment id>" }.
// We vertrouwen de body niet: syncOrderByPaymentId haalt de betaling vers op
// bij Mollie en bepaalt daar de status.
//
// Antwoordcodes (Mollie retry't bij non-2xx met oplopende intervallen):
//   400 — ongeldig/ontbrekend id: retry heeft geen zin.
//   200 — verwerkt, óf onbekende betaling/order: niets te doen.
//   500 — Mollie/DB-fout: retry gewenst (de sync is idempotent).
export async function POST(req: NextRequest) {
  let id: FormDataEntryValue | null;
  try {
    id = (await req.formData()).get("id");
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  if (typeof id !== "string" || !/^tr_[A-Za-z0-9]{6,40}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
  }

  try {
    const status = await syncOrderByPaymentId(id);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    if (isMollieNotFound(e)) return NextResponse.json({ ok: true, status: null });
    captureError(e, { scope: "mollieWebhook", paymentId: id });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
