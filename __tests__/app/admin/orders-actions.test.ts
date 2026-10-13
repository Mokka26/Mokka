import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { makeOrder } from "@/__tests__/helpers/fixtures";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendShippingConfirmation } from "@/lib/email";
import { deleteOrder, updateOrderFulfillment } from "@/app/admin/(protected)/orders/actions";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/email", () => ({ sendShippingConfirmation: jest.fn() }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const db = asPrismaMock(prisma);
// NextAuth's `auth` is overbelast getypeerd; één cast naar een gewone jest.Mock.
const authMock = auth as unknown as jest.Mock;

function fulfillmentForm(status: string, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("id", "order_1");
  fd.append("fulfillmentStatus", status);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
}

describe("app/admin/orders/actions", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: "admin_1" } });
    jest.mocked(sendShippingConfirmation).mockResolvedValue(true);
  });

  describe("deleteOrder", () => {
    it("archiveert een betaalde bestelling (bewaarplicht) in plaats van haar te verwijderen", async () => {
      db.order.findUnique.mockResolvedValue({ id: "order_1", orderNumber: "MOK-261012-ABCDE", status: "paid", archivedAt: null });
      db.order.update.mockResolvedValue({});
      expect(await deleteOrder({ id: "order_1", confirmation: "MOK-261012-ABCDE" })).toEqual({ ok: true, archived: true });
      expect(db.order.update).toHaveBeenCalledWith({ where: { id: "order_1" }, data: { archivedAt: expect.any(Date) } });
      expect(db.order.delete).not.toHaveBeenCalled();
    });

    it("eist voor een betaalde bestelling het getypte ordernummer", async () => {
      db.order.findUnique.mockResolvedValue({ id: "order_1", orderNumber: "MOK-261012-ABCDE", status: "paid", archivedAt: null });
      expect(await deleteOrder({ id: "order_1", confirmation: "fout" })).toMatchObject({ ok: false, error: expect.stringContaining("MOK-261012-ABCDE") });
      expect(db.order.update).not.toHaveBeenCalled();
    });

    it("meldt een al gearchiveerde bestelling", async () => {
      db.order.findUnique.mockResolvedValue({ id: "order_1", orderNumber: "MOK-261012-ABCDE", status: "paid", archivedAt: new Date() });
      expect(await deleteOrder({ id: "order_1", confirmation: "MOK-261012-ABCDE" })).toEqual({ ok: false, error: "Deze bestelling is al gearchiveerd." });
    });

    it("verwijdert een niet-betaalde bestelling wél definitief", async () => {
      db.order.findUnique.mockResolvedValue({ id: "order_1", orderNumber: "MOK-261012-ABCDE", status: "expired", archivedAt: null });
      db.order.delete.mockResolvedValue({});
      expect(await deleteOrder({ id: "order_1" })).toEqual({ ok: true, archived: false });
      expect(db.order.delete).toHaveBeenCalledWith({ where: { id: "order_1" } });
    });

    it("weigert zonder sessie en bij een onbekende bestelling", async () => {
      authMock.mockResolvedValueOnce(null);
      expect(await deleteOrder({ id: "order_1" })).toEqual({ ok: false, error: "Niet ingelogd" });
      db.order.findUnique.mockResolvedValue(null);
      expect(await deleteOrder({ id: "order_1" })).toMatchObject({ ok: false, error: expect.stringContaining("niet gevonden") });
    });
  });

  describe("updateOrderFulfillment", () => {
    it("flipt conditioneel naar 'verzonden' en mailt alleen als deze aanroep de rij flipte (count 1)", async () => {
      db.order.findUnique
        .mockResolvedValueOnce({ id: "order_1", fulfillmentStatus: "processing", shippedAt: null })
        .mockResolvedValueOnce(makeOrder({ status: "paid", fulfillmentStatus: "shipped" }));
      db.order.updateMany.mockResolvedValue({ count: 1 });
      const result = await updateOrderFulfillment({}, fulfillmentForm("shipped", { trackingCode: "3SABC123", trackingUrl: "https://track.example/3SABC123" }));
      expect(result).toMatchObject({ ok: true, mail: "sent" });
      expect(db.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order_1", fulfillmentStatus: { not: "shipped" } },
        data: { fulfillmentStatus: "shipped", trackingCode: "3SABC123", trackingUrl: "https://track.example/3SABC123", adminNote: null, shippedAt: expect.any(Date) },
      });
      expect(sendShippingConfirmation).toHaveBeenCalledTimes(1);
      expect(sendShippingConfirmation).toHaveBeenCalledWith(expect.objectContaining({ id: "order_1", email: "jan@example.com" }));
    });

    it("mailt NIET als een gelijktijdige opslag de status al op 'verzonden' zette (count 0)", async () => {
      db.order.findUnique.mockResolvedValueOnce({ id: "order_1", fulfillmentStatus: "processing", shippedAt: null });
      db.order.updateMany.mockResolvedValue({ count: 0 });
      db.order.update.mockResolvedValue({});
      const result = await updateOrderFulfillment({}, fulfillmentForm("shipped"));
      expect(result).toMatchObject({ ok: true, mail: "skipped" });
      expect(sendShippingConfirmation).not.toHaveBeenCalled();
      // De tekstvelden worden wel bijgewerkt.
      expect(db.order.update).toHaveBeenCalledWith({ where: { id: "order_1" }, data: expect.objectContaining({ fulfillmentStatus: "shipped" }) });
    });

    it("mailt niet opnieuw als de bestelling al verzonden was en houdt shippedAt", async () => {
      const shippedAt = new Date("2026-10-01T10:00:00Z");
      db.order.findUnique.mockResolvedValueOnce({ id: "order_1", fulfillmentStatus: "shipped", shippedAt });
      db.order.update.mockResolvedValue({});
      expect(await updateOrderFulfillment({}, fulfillmentForm("shipped", { adminNote: "Gebeld" }))).toMatchObject({ ok: true, mail: "skipped" });
      expect(db.order.updateMany).not.toHaveBeenCalled();
      expect(db.order.update).toHaveBeenCalledWith({ where: { id: "order_1" }, data: expect.objectContaining({ adminNote: "Gebeld", shippedAt }) });
      expect(sendShippingConfirmation).not.toHaveBeenCalled();
    });

    it("geeft 'failed' terug als de verzendmail mislukt, maar de status staat wel", async () => {
      db.order.findUnique
        .mockResolvedValueOnce({ id: "order_1", fulfillmentStatus: "pending", shippedAt: null })
        .mockResolvedValueOnce(makeOrder({ fulfillmentStatus: "shipped" }));
      db.order.updateMany.mockResolvedValue({ count: 1 });
      jest.mocked(sendShippingConfirmation).mockResolvedValue(false);
      expect(await updateOrderFulfillment({}, fulfillmentForm("shipped"))).toMatchObject({ ok: true, mail: "failed" });
    });

    it("valideert velden (ongeldige status, tracking-URL zonder https)", async () => {
      expect(await updateOrderFulfillment({}, fulfillmentForm("verzonden"))).toMatchObject({ fieldErrors: { fulfillmentStatus: expect.any(String) } });
      expect(await updateOrderFulfillment({}, fulfillmentForm("shipped", { trackingUrl: "track.example" }))).toMatchObject({
        fieldErrors: { trackingUrl: "Begin met https://" },
      });
      expect(db.order.findUnique).not.toHaveBeenCalled();
    });
  });
});
