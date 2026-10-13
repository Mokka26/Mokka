import { shippingInfo } from "@/lib/shipping-info";
import { makeOrder, makeOrderItem } from "@/__tests__/helpers/fixtures";
import { captureError } from "@/lib/sentry";
import { after } from "next/server";
import {
  buildPurchasePayload,
  deterministicClientId,
  isServerAnalyticsEnabled,
  queueServerPurchase,
  sendServerPurchase,
  shouldSendServerPurchase,
  SERVER_PURCHASE_EVENT,
  type ServerPurchaseOrder,
} from "@/lib/analytics-server";

jest.mock("server-only", () => ({}));
jest.mock("next/server", () => ({ after: jest.fn() }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));

function purchaseOrder(overrides: Partial<ServerPurchaseOrder> = {}): ServerPurchaseOrder {
  const order = makeOrder({
    total: 1248,
    shipping: 49,
    paymentMethod: "ideal",
    paidAt: new Date("2026-10-12T10:00:00.000Z"),
    analyticsConsent: true,
    items: [
      makeOrderItem({ productId: "bed", productName: "Bed Oslo", variantLabel: "160 × 200", quantity: 1, price: 999 }),
      makeOrderItem({ id: "i2", productId: "lamp", productName: "Tafellamp Noor", quantity: 4, price: 50 }),
    ],
  });
  return { ...order, ...overrides };
}

describe("lib/analytics-server", () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    // De module leest de env bij het laden; de enable-check gebruikt de
    // module-constanten. Voor de "ingeschakeld"-paden herladen we de module.
    jest.resetModules();
    process.env = { ...ORIGINAL };
  });
  afterAll(() => {
    process.env = ORIGINAL;
  });

  describe("buildPurchasePayload (mapping)", () => {
    it("mapt orderregels, btw uit shipping-info, verzending en een deterministische client_id", () => {
      const payload = buildPurchasePayload(purchaseOrder()) as {
        client_id: string;
        timestamp_micros: number;
        non_personalized_ads: boolean;
        events: Array<{ name: string; params: Record<string, unknown> }>;
      };
      expect(payload.client_id).toBe(deterministicClientId("0123456789abcdef0123456789abcdef"));
      expect(payload.client_id).toMatch(/^\d{10}\.\d{10}$/);
      expect(payload.timestamp_micros).toBe(new Date("2026-10-12T10:00:00.000Z").getTime() * 1000);
      expect(payload.non_personalized_ads).toBe(true);
      expect(payload.events).toHaveLength(1);
      const [event] = payload.events;
      // Zonder gaClientId heet het event server_purchase (geen dubbeltelling met de browser-purchase).
      expect(event.name).toBe(SERVER_PURCHASE_EVENT);
      const vat = shippingInfo.vatRatePercent;
      expect(event.params).toMatchObject({
        transaction_id: "MOK-261012-ABCDE",
        value: 1199, // som van de regels, excl. verzending
        shipping: 49,
        tax: Math.round((1248 - 1248 / (1 + vat / 100)) * 100) / 100,
        currency: "EUR",
        payment_type: "ideal",
        engagement_time_msec: 100,
      });
      expect(event.params.items).toEqual([
        { item_id: "bed", item_name: "Bed Oslo", item_variant: "160 × 200", price: 999, quantity: 1 },
        { item_id: "lamp", item_name: "Tafellamp Noor", price: 50, quantity: 4 },
      ]);
    });

    it("gebruikt het echte GA-client-id en de naam 'purchase' zodra dat bekend is", () => {
      const payload = buildPurchasePayload(purchaseOrder({ gaClientId: "1111111111.2222222222" })) as {
        client_id: string;
        events: Array<{ name: string }>;
      };
      expect(payload.client_id).toBe("1111111111.2222222222");
      expect(payload.events[0].name).toBe("purchase");
    });

    it("valt zonder regels terug op totaal minus verzending en zonder paidAt op nu", () => {
      const before = Date.now();
      const payload = buildPurchasePayload(purchaseOrder({ items: [], paidAt: null, paymentMethod: null })) as {
        timestamp_micros: number;
        events: Array<{ params: Record<string, unknown> }>;
      };
      expect(payload.events[0].params.value).toBe(1199);
      expect(payload.events[0].params).not.toHaveProperty("payment_type");
      expect(payload.timestamp_micros / 1000).toBeGreaterThanOrEqual(before);
    });

    it("maakt een stabiel client_id per seed, verschillend per order", () => {
      expect(deterministicClientId("a")).toBe(deterministicClientId("a"));
      expect(deterministicClientId("a")).not.toBe(deterministicClientId("b"));
    });
  });

  describe("consent", () => {
    it("is zonder GA4-configuratie altijd uit, ook met akkoord", () => {
      expect(isServerAnalyticsEnabled()).toBe(false);
      expect(shouldSendServerPurchase({ analyticsConsent: true })).toBe(false);
    });

    it("stuurt met configuratie alléén bij analyticsConsent === true", async () => {
      process.env.NEXT_PUBLIC_GA4_ID = "G-TEST1234";
      process.env.GA4_API_SECRET = "secret";
      const mod = await import("@/lib/analytics-server");
      expect(mod.isServerAnalyticsEnabled()).toBe(true);
      expect(mod.shouldSendServerPurchase({ analyticsConsent: true })).toBe(true);
      expect(mod.shouldSendServerPurchase({ analyticsConsent: false })).toBe(false);

      const fetchMock = jest.fn(async () => ({ ok: true, status: 204 }));
      global.fetch = fetchMock as unknown as typeof fetch;

      expect(await mod.sendServerPurchase(purchaseOrder({ analyticsConsent: false }))).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();

      expect(await mod.sendServerPurchase(purchaseOrder({ analyticsConsent: true }))).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }];
      expect(url).toContain("measurement_id=G-TEST1234");
      expect(url).toContain("api_secret=secret");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toMatchObject({ events: [{ params: { transaction_id: "MOK-261012-ABCDE" } }] });
    });

    it("queueServerPurchase plant niets zonder akkoord en gebruikt after() mét akkoord", async () => {
      process.env.NEXT_PUBLIC_GA4_ID = "G-TEST1234";
      process.env.GA4_API_SECRET = "secret";
      const mod = await import("@/lib/analytics-server");
      const afterMock = jest.mocked((await import("next/server")).after);
      mod.queueServerPurchase(purchaseOrder({ analyticsConsent: false }));
      expect(afterMock).not.toHaveBeenCalled();
      mod.queueServerPurchase(purchaseOrder({ analyticsConsent: true }));
      expect(afterMock).toHaveBeenCalledTimes(1);
    });

    it("gooit nooit: een transportfout gaat naar Sentry en geeft false", async () => {
      process.env.NEXT_PUBLIC_GA4_ID = "G-TEST1234";
      process.env.GA4_API_SECRET = "secret";
      const mod = await import("@/lib/analytics-server");
      const sentry = await import("@/lib/sentry");
      global.fetch = jest.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
      expect(await mod.sendServerPurchase(purchaseOrder())).toBe(false);
      expect(jest.mocked(sentry.captureError)).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ scope: "ga4ServerPurchase" }));
    });
  });

  // Statisch geïmporteerde symbolen blijven bruikbaar (zelfde contract als de herladen module).
  it("exporteert dezelfde API statisch", () => {
    expect(typeof queueServerPurchase).toBe("function");
    expect(typeof sendServerPurchase).toBe("function");
    expect(typeof after).toBe("function");
    expect(typeof captureError).toBe("function");
  });
});
