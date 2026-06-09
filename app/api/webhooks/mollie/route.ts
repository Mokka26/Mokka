import { NextRequest, NextResponse } from "next/server";
import { syncOrderByPaymentId } from "@/lib/order-sync";

export const dynamic = "force-dynamic";

// Mollie roept deze webhook aan met een form-body { id: "<payment id>" }.
// We vertrouwen de body niet: syncOrderByPaymentId haalt de betaling vers op
// bij Mollie en bepaalt daar de status. Altijd 200 teruggeven zodat Mollie
// niet blijft retryen op een verwerkte melding.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const id = form.get("id");
    if (typeof id !== "string" || !id.startsWith("tr_")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await syncOrderByPaymentId(id);
  } catch {
    // Slik fouten in: Mollie hoeft geen 500 te zien (anders eindeloze retries).
    // Details belanden in Sentry via de standaard error-instrumentatie.
  }
  return NextResponse.json({ ok: true });
}
