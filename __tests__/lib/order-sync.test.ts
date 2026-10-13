import type { MollieClient } from "@mollie/api-client";
import { asPrismaMock, createTxMock, useTransaction } from "@/__tests__/helpers/prisma-mock";
import { makeOrder, makeOrderItem } from "@/__tests__/helpers/fixtures";
import { prisma } from "@/lib/prisma";
import { getMollie } from "@/lib/mollie";
import { sendOrderConfirmation } from "@/lib/email";
import { captureError, captureWarning } from "@/lib/sentry";
import { revalidateProduct } from "@/lib/revalidate";
import { queueServerPurchase } from "@/lib/analytics-server";
import { syncOrderByPaymentId, getOrderForReturnPage, reconcileOpenOrders, resendPendingConfirmations } from "@/lib/order-sync";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/lib/mollie", () => ({ getMollie: jest.fn() }));
jest.mock("@/lib/email", () => ({ sendOrderConfirmation: jest.fn() }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));
jest.mock("@/lib/revalidate", () => ({ revalidateProduct: jest.fn() }));
jest.mock("@/lib/analytics-server", () => ({ queueServerPurchase: jest.fn() }));

const db = asPrismaMock(prisma);
const paymentsGet = jest.fn();
const sendMail = jest.mocked(sendOrderConfirmation);

type FakePayment = {
  status: string;
  metadata: { orderId?: string } | null;
  paidAt?: string;
  authorizedAt?: string;
  method?: string | null;
};

function mockPayment(overrides: Partial<FakePayment> = {}): FakePayment {
  const payment: FakePayment = {
    status: "paid",
    metadata: { orderId: "order_1" },
    paidAt: "2026-10-12T10:00:00.000Z",
    method: "ideal",
    ...overrides,
  };
  paymentsGet.mockResolvedValue(payment);
  return payment;
}

describe("lib/order-sync · syncOrderByPaymentId", () => {
  let tx: ReturnType<typeof createTxMock>;

  beforeEach(() => {
    jest.mocked(getMollie).mockReturnValue({ payments: { get: paymentsGet } } as unknown as MollieClient);
    tx = createTxMock();
    useTransaction(db, tx);
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    db.order.update.mockResolvedValue({});
    db.order.updateMany.mockResolvedValue({ count: 1 });
    db.product.findMany.mockResolvedValue([{ slug: "bed-oslo", category: "bedden" }]);
    sendMail.mockResolvedValue(true);
  });

  it("geeft null zonder orderId in de metadata en raakt de database niet", async () => {
    mockPayment({ metadata: null });
    expect(await syncOrderByPaymentId("tr_test123")).toBeNull();
    expect(paymentsGet).toHaveBeenCalledWith("tr_test123");
    expect(db.order.findUnique).not.toHaveBeenCalled();
  });

  it("geeft null bij een onbekende order", async () => {
    mockPayment();
    db.order.findUnique.mockResolvedValue(null);
    expect(await syncOrderByPaymentId("tr_test123")).toBeNull();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("doet niets als de status al gelijk is", async () => {
    mockPayment({ status: "open" });
    db.order.findUnique.mockResolvedValue(makeOrder({ status: "open" }));
    expect(await syncOrderByPaymentId("tr_test123")).toBe("open");
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("boekt voorraad af, stuurt de bevestiging en markeert confirmationSentAt als de claim slaagt", async () => {
    const payment = mockPayment();
    const order = makeOrder({
      analyticsConsent: true,
      items: [makeOrderItem({ productId: "prod_1", quantity: 2 }), makeOrderItem({ id: "item_2", productId: "prod_2", quantity: 1 })],
    });
    db.order.findUnique.mockResolvedValue(order);

    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");

    expect(tx.order.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order_1", status: { not: "paid" } },
      data: { status: "paid", paidAt: new Date(payment.paidAt!), paymentMethod: "ideal" },
    });
    expect(tx.product.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "prod_1", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "prod_2", stock: { gte: 1 } },
      data: { stock: { decrement: 1 } },
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ id: "order_1", status: "paid", paymentMethod: "ideal" }));
    // Atomaire claim op confirmationSentAt VÓÓR het mailen (count === 1 → mailen).
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order_1", confirmationSentAt: null },
      data: { confirmationSentAt: expect.any(Date) },
    });
    expect(db.order.updateMany).toHaveBeenCalledTimes(1); // geen release: mail gelukt
    // Webhook/cron-context: tag direct laten vervallen (background), niet via updateTag.
    expect(revalidateProduct).toHaveBeenCalledWith({ slug: "bed-oslo", category: "bedden" }, undefined, { mode: "background" });
    // Server-side GA4-purchase: precies één keer, alleen door de claimende aanroep
    // én alleen met cookie-akkoord (analyticsConsent: true).
    expect(queueServerPurchase).toHaveBeenCalledTimes(1);
    expect(queueServerPurchase).toHaveBeenCalledWith(expect.objectContaining({ id: "order_1", paymentMethod: "ideal", analyticsConsent: true }));
    expect(captureWarning).not.toHaveBeenCalled();
  });

  it("stuurt GEEN server-side purchase zonder cookie-akkoord (analyticsConsent false)", async () => {
    mockPayment();
    db.order.findUnique.mockResolvedValue(makeOrder({ analyticsConsent: false }));
    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");
    expect(queueServerPurchase).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("mailt niet als de bevestiging al door een andere aanroep geclaimd is", async () => {
    mockPayment();
    db.order.findUnique.mockResolvedValue(makeOrder());
    db.order.updateMany.mockResolvedValue({ count: 0 });
    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("boekt NIET af en mailt NIET als een andere aanroep de claim al won (count 0)", async () => {
    mockPayment();
    db.order.findUnique.mockResolvedValue(makeOrder({ status: "open" }));
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(db.order.update).not.toHaveBeenCalled();
    expect(revalidateProduct).not.toHaveBeenCalled();
    expect(queueServerPurchase).not.toHaveBeenCalled();
  });

  it("downgradet een betaalde order nooit (bv. canceled na authorized)", async () => {
    mockPayment({ status: "canceled" });
    db.order.findUnique.mockResolvedValue(makeOrder({ status: "paid" }));
    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("behandelt 'authorized' (Klarna/in3) als betaald, met authorizedAt als betaaldatum", async () => {
    mockPayment({ status: "authorized", paidAt: undefined, authorizedAt: "2026-10-12T11:00:00.000Z", method: "klarna" });
    db.order.findUnique.mockResolvedValue(makeOrder());
    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "paid", paidAt: new Date("2026-10-12T11:00:00.000Z"), paymentMethod: "klarna" } }),
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["failed", "failed"],
    ["canceled", "canceled"],
    ["expired", "expired"],
    ["pending", "open"],
  ])("zet Mollie-status %p conditioneel om naar %p zonder voorraad of mail", async (mollieStatus, expected) => {
    mockPayment({ status: mollieStatus });
    db.order.findUnique.mockResolvedValue(makeOrder({ status: expected === "open" ? "failed" : "open" }));
    expect(await syncOrderByPaymentId("tr_test123")).toBe(expected);
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order_1", status: { not: "paid" } },
      data: { status: expected },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("laat een mailfout de sync niet breken en geeft de claim op confirmationSentAt weer vrij", async () => {
    mockPayment();
    db.order.findUnique.mockResolvedValue(makeOrder());
    sendMail.mockRejectedValue(new Error("SMTP down"));

    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");
    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(db.order.updateMany).toHaveBeenLastCalledWith({ where: { id: "order_1" }, data: { confirmationSentAt: null } });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ scope: "orderConfirmation" }));
  });

  it("geeft de claim vrij wanneer de mailer false teruggeeft", async () => {
    mockPayment();
    db.order.findUnique.mockResolvedValue(makeOrder());
    sendMail.mockResolvedValue(false);
    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");
    expect(db.order.updateMany).toHaveBeenLastCalledWith({ where: { id: "order_1" }, data: { confirmationSentAt: null } });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("klemt de voorraad op 0 en waarschuwt bij overselling", async () => {
    mockPayment();
    db.order.findUnique.mockResolvedValue(makeOrder({ items: [makeOrderItem({ productId: "prod_1", quantity: 3 })] }));
    tx.product.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");
    expect(tx.product.updateMany).toHaveBeenNthCalledWith(2, { where: { id: "prod_1" }, data: { stock: 0 } });
    expect(captureWarning).toHaveBeenCalledWith(
      expect.stringContaining("Overselling"),
      expect.objectContaining({ orderNumber: "MOK-261012-ABCDE", productId: "prod_1" }),
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("slaat het verversen van pagina's over met revalidate: false", async () => {
    mockPayment();
    db.order.findUnique.mockResolvedValue(makeOrder());
    expect(await syncOrderByPaymentId("tr_test123", { revalidate: false })).toBe("paid");
    expect(db.product.findMany).not.toHaveBeenCalled();
    expect(revalidateProduct).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("laat een fout bij het verversen de sync niet breken", async () => {
    mockPayment();
    db.order.findUnique.mockResolvedValue(makeOrder());
    db.product.findMany.mockRejectedValue(new Error("DB hik"));
    expect(await syncOrderByPaymentId("tr_test123")).toBe("paid");
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ scope: "revalidateStockPages" }));
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("gooit door als Mollie of de transactie faalt (webhook → 500 → retry)", async () => {
    paymentsGet.mockRejectedValue(new Error("Mollie onbereikbaar"));
    await expect(syncOrderByPaymentId("tr_test123")).rejects.toThrow("Mollie onbereikbaar");

    mockPayment();
    db.order.findUnique.mockResolvedValue(makeOrder());
    db.$transaction.mockRejectedValue(new Error("transactie mislukt"));
    await expect(syncOrderByPaymentId("tr_test123")).rejects.toThrow("transactie mislukt");
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("lib/order-sync · getOrderForReturnPage", () => {
  const view = { orderNumber: "MOK-261012-ABCDE", status: "open", total: 599, firstName: "Jan", email: "jan@example.com", molliePaymentId: "tr_test123" };

  beforeEach(() => {
    jest.mocked(getMollie).mockReturnValue({ payments: { get: paymentsGet } } as unknown as MollieClient);
  });

  it("geeft null voor een onbekende token", async () => {
    db.order.findUnique.mockResolvedValue(null);
    expect(await getOrderForReturnPage({ publicToken: "x" }, { allowSync: true })).toBeNull();
    expect(paymentsGet).not.toHaveBeenCalled();
  });

  it("synct niet als de order al betaald is, geen betaling heeft of sync niet is toegestaan", async () => {
    db.order.findUnique.mockResolvedValue({ ...view, status: "paid" });
    expect(await getOrderForReturnPage({ publicToken: "x" }, { allowSync: true })).toMatchObject({ status: "paid" });
    db.order.findUnique.mockResolvedValue({ ...view, molliePaymentId: null });
    expect(await getOrderForReturnPage({ orderNumber: view.orderNumber }, { allowSync: true })).toMatchObject({ status: "open" });
    db.order.findUnique.mockResolvedValue(view);
    expect(await getOrderForReturnPage({ publicToken: "x" }, { allowSync: false })).toMatchObject({ status: "open" });
    expect(paymentsGet).not.toHaveBeenCalled();
  });

  it("synct een open order zonder pagina's te verversen en leest daarna opnieuw", async () => {
    mockPayment({ status: "failed" });
    db.order.findUnique
      .mockResolvedValueOnce(view) // view-select
      .mockResolvedValueOnce(makeOrder({ status: "open" })) // in syncOrderByPaymentId
      .mockResolvedValueOnce({ ...view, status: "failed" }); // herlezen
    db.order.updateMany.mockResolvedValue({ count: 1 });
    expect(await getOrderForReturnPage({ publicToken: "x" }, { allowSync: true })).toMatchObject({ status: "failed" });
    expect(db.product.findMany).not.toHaveBeenCalled();
  });

  it("toont de laatst bekende status als Mollie faalt", async () => {
    paymentsGet.mockRejectedValue(new Error("Mollie down"));
    db.order.findUnique.mockResolvedValue(view);
    expect(await getOrderForReturnPage({ publicToken: "x" }, { allowSync: true })).toMatchObject({ status: "open" });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ scope: "returnPageSync" }));
  });
});

describe("lib/order-sync · reconcileOpenOrders", () => {
  beforeEach(() => {
    jest.mocked(getMollie).mockReturnValue({ payments: { get: paymentsGet } } as unknown as MollieClient);
    db.order.updateMany.mockResolvedValue({ count: 2 });
  });

  it("synct oude open orders, telt updates en fouten en laat betalingloze orders verlopen", async () => {
    db.order.findMany.mockResolvedValue([
      { id: "o1", orderNumber: "MOK-1", molliePaymentId: "tr_1" },
      { id: "o2", orderNumber: "MOK-2", molliePaymentId: "tr_2" },
      { id: "o3", orderNumber: "MOK-3", molliePaymentId: "tr_3" },
    ]);
    paymentsGet
      .mockResolvedValueOnce({ status: "expired", metadata: { orderId: "o1" } })
      .mockResolvedValueOnce({ status: "open", metadata: { orderId: "o2" } })
      .mockRejectedValueOnce(new Error("Mollie 500"));
    db.order.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => makeOrder({ id: where.id, status: "open" }));

    const result = await reconcileOpenOrders(30);
    expect(result).toEqual({ checked: 3, updated: 1, expiredWithoutPayment: 2, errors: 1 });
    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "open", molliePaymentId: { not: null } }), take: 50 }),
    );
    expect(db.order.updateMany).toHaveBeenLastCalledWith({
      where: { status: "open", molliePaymentId: null, createdAt: { lt: expect.any(Date) } },
      data: { status: "expired" },
    });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ scope: "reconcileOpenOrders", orderNumber: "MOK-3" }));
  });
});

describe("lib/order-sync · resendPendingConfirmations", () => {
  it("claimt atomair, verstuurt alsnog en geeft de claim bij een mislukte mail weer vrij", async () => {
    db.order.findMany.mockResolvedValue([makeOrder({ id: "a", status: "paid" }), makeOrder({ id: "b", status: "paid" })]);
    sendMail.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    db.order.updateMany.mockResolvedValue({ count: 1 });
    expect(await resendPendingConfirmations()).toEqual({ attempted: 2, sent: 1 });
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(db.order.updateMany).toHaveBeenCalledWith({ where: { id: "a", confirmationSentAt: null }, data: { confirmationSentAt: expect.any(Date) } });
    expect(db.order.updateMany).toHaveBeenCalledWith({ where: { id: "b", confirmationSentAt: null }, data: { confirmationSentAt: expect.any(Date) } });
    expect(db.order.updateMany).toHaveBeenLastCalledWith({ where: { id: "b" }, data: { confirmationSentAt: null } });
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it("pakt alleen orders die minstens 10 minuten geleden betaald zijn (en hooguit 7 dagen)", async () => {
    const before = Date.now();
    db.order.findMany.mockResolvedValue([]);
    expect(await resendPendingConfirmations()).toEqual({ attempted: 0, sent: 0 });
    const args = db.order.findMany.mock.calls[0][0] as { where: { status: string; confirmationSentAt: null; paidAt: { gte: Date; lt: Date } }; take: number };
    expect(args.where).toMatchObject({ status: "paid", confirmationSentAt: null });
    expect(args.take).toBe(20);
    const { gte, lt } = args.where.paidAt;
    expect(before - lt.getTime()).toBeGreaterThanOrEqual(10 * 60 * 1000 - 1000);
    expect(before - lt.getTime()).toBeLessThan(10 * 60 * 1000 + 5000);
    expect(before - gte.getTime()).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
  });

  it("mailt niet als een andere run de claim al won (count 0)", async () => {
    db.order.findMany.mockResolvedValue([makeOrder({ id: "a", status: "paid" })]);
    db.order.updateMany.mockResolvedValue({ count: 0 });
    expect(await resendPendingConfirmations()).toEqual({ attempted: 1, sent: 0 });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
