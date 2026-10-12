import { NextRequest } from "next/server";
import { syncOrderByPaymentId } from "@/lib/order-sync";
import { isMollieNotFound } from "@/lib/mollie";
import { captureError } from "@/lib/sentry";
import { POST } from "@/app/api/webhooks/mollie/route";

jest.mock("@/lib/order-sync", () => ({ syncOrderByPaymentId: jest.fn() }));
jest.mock("@/lib/mollie", () => ({ isMollieNotFound: jest.fn(() => false) }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn() }));

const URL = "http://localhost:3000/api/webhooks/mollie";

function formRequest(fields: Record<string, string>): NextRequest {
  return new NextRequest(URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("POST /api/webhooks/mollie", () => {
  it("antwoordt 400 bij een ongeldige body (retry heeft geen zin)", async () => {
    const req = new NextRequest(URL, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid body" });
    expect(syncOrderByPaymentId).not.toHaveBeenCalled();
  });

  const invalidIds: Array<Record<string, string>> = [
    {},
    { id: "" },
    { id: "foo" },
    { id: "tr_" },
    { id: "tr_abc" },
    { id: "tr_abc123; DROP" },
    { id: `tr_${"a".repeat(41)}` },
  ];

  it.each(invalidIds)("antwoordt 400 bij een ongeldig id %p", async (fields) => {
      const res = await POST(formRequest(fields));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: "invalid id" });
      expect(syncOrderByPaymentId).not.toHaveBeenCalled();
  });

  it("antwoordt 200 met de status na een geslaagde sync", async () => {
    jest.mocked(syncOrderByPaymentId).mockResolvedValue("paid");
    const res = await POST(formRequest({ id: "tr_WDqYK6vllg" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "paid" });
    expect(syncOrderByPaymentId).toHaveBeenCalledWith("tr_WDqYK6vllg");
  });

  it("antwoordt 200 met status null voor een onbekende betaling/order", async () => {
    jest.mocked(syncOrderByPaymentId).mockResolvedValue(null);
    const res = await POST(formRequest({ id: "tr_WDqYK6vllg" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: null });
  });

  it("antwoordt 200 als Mollie het id niet kent (404), zonder Sentry-melding", async () => {
    jest.mocked(syncOrderByPaymentId).mockRejectedValue(new Error("not found"));
    jest.mocked(isMollieNotFound).mockReturnValueOnce(true);
    const res = await POST(formRequest({ id: "tr_WDqYK6vllg" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: null });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("antwoordt 500 bij een Mollie-/DB-fout zodat Mollie opnieuw probeert", async () => {
    jest.mocked(syncOrderByPaymentId).mockRejectedValue(new Error("db down"));
    const res = await POST(formRequest({ id: "tr_WDqYK6vllg" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { scope: "mollieWebhook", paymentId: "tr_WDqYK6vllg" });
  });
});
