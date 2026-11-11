import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { reconcileOpenOrders, resendPendingConfirmations } from "@/lib/order-sync";
import { captureError } from "@/lib/sentry";
import { GET as reconcileGET, POST as reconcilePOST } from "@/app/api/cron/reconcile-orders/route";
import { GET as cleanupGET } from "@/app/api/cron/cleanup/route";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/lib/order-sync", () => ({ reconcileOpenOrders: jest.fn(), resendPendingConfirmations: jest.fn() }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));

const db = asPrismaMock(prisma);
const SECRET = "test-cron-secret-123";

function req(path: string, auth?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "GET",
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("cron-beveiliging", () => {
  it.each([
    ["zonder header", undefined],
    ["met verkeerde sleutel", "Bearer verkeerd-geheim-12345"],
    ["zonder Bearer", SECRET],
  ])("weigert %s (401) en doet niets", async (_label, auth) => {
    const res = await reconcileGET(req("/api/cron/reconcile-orders", auth));
    expect(res.status).toBe(401);
    expect(reconcileOpenOrders).not.toHaveBeenCalled();
  });

  it("weigert alles als CRON_SECRET niet gezet is (fail-closed)", async () => {
    delete process.env.CRON_SECRET;
    const res = await cleanupGET(req("/api/cron/cleanup", "Bearer "));
    expect(res.status).toBe(401);
    expect(db.rateLimit.deleteMany).not.toHaveBeenCalled();
  });

  it("GET en POST zijn dezelfde handler (Vercel-cron gebruikt GET)", () => {
    expect(reconcileGET).toBe(reconcilePOST);
  });
});

describe("reconcile-orders", () => {
  it("synchroniseert open orders en verstuurt achterstallige bevestigingen", async () => {
    (reconcileOpenOrders as jest.Mock).mockResolvedValue({ checked: 2, updated: 1, expiredWithoutPayment: 0, errors: 0 });
    (resendPendingConfirmations as jest.Mock).mockResolvedValue({ attempted: 1, sent: 1 });
    const res = await reconcileGET(req("/api/cron/reconcile-orders", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(reconcileOpenOrders).toHaveBeenCalledWith(15);
    expect(await res.json()).toEqual({
      ok: true,
      reconcile: { checked: 2, updated: 1, expiredWithoutPayment: 0, errors: 0 },
      confirmations: { attempted: 1, sent: 1 },
    });
  });

  it("meldt een fout aan Sentry en antwoordt 500", async () => {
    (reconcileOpenOrders as jest.Mock).mockRejectedValue(new Error("Mollie down"));
    const res = await reconcileGET(req("/api/cron/reconcile-orders", `Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    expect(captureError).toHaveBeenCalled();
  });
});

describe("cleanup", () => {
  it("ruimt verlopen rate limits en onbevestigde aanmeldingen op", async () => {
    db.rateLimit.deleteMany.mockResolvedValue({ count: 3 });
    db.newsletterSubscriber.deleteMany.mockResolvedValue({ count: 2 });
    db.newsletterSubscriber.updateMany.mockResolvedValue({ count: 1 });
    const res = await cleanupGET(req("/api/cron/cleanup", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      rateLimitsDeleted: 3,
      unconfirmedSubscribersDeleted: 2,
      expiredResubscribeTokens: 1,
    });
    // Alleen double-opt-in-rijen die na 7 dagen niet bevestigd zijn.
    expect(db.newsletterSubscriber.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ confirmedAt: null, confirmToken: { not: null } }),
    });
  });
});
