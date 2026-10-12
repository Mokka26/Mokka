import type { MollieClient } from "@mollie/api-client";
import { headers, cookies } from "next/headers";
import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { makeProduct, makeCustomer } from "@/__tests__/helpers/fixtures";
import { prisma } from "@/lib/prisma";
import { getMollie } from "@/lib/mollie";
import { rateLimitIp } from "@/lib/rate-limit";
import { captureError } from "@/lib/sentry";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { toCents } from "@/lib/money";
import { createCheckout, getPaymentMethods } from "@/app/checkout/actions";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("next/headers", () => ({ headers: jest.fn(), cookies: jest.fn() }));
jest.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));
jest.mock("@/lib/mollie", () => ({
  ...jest.requireActual<typeof import("@/lib/mollie")>("@/lib/mollie"),
  getMollie: jest.fn(),
  listEnabledMethods: jest.fn(async () => null),
}));
jest.mock("@/lib/rate-limit", () => ({ rateLimitIp: jest.fn() }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));

const db = asPrismaMock(prisma);
const paymentsCreate = jest.fn();
const CHECKOUT_URL = "https://www.mollie.com/checkout/select-method/abc123";
const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

const bed = makeProduct({ id: "bed", name: "Bed Oslo", price: 599, stock: 5 });
const lamp = makeProduct({ id: "lamp", name: "Tafellamp Noor", category: "tafellampen", price: 49.95, stock: 3 });

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    customer: makeCustomer(),
    items: [{ productId: "bed", quantity: 1 }],
    ...overrides,
  };
}

/** Argumenten van de laatste payments.create-aanroep. */
function lastPaymentArgs(): Record<string, unknown> {
  return paymentsCreate.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

describe("app/checkout/actions · createCheckout", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    jest.mocked(headers).mockResolvedValue(new Headers({ host: "localhost:3000" }) as unknown as Awaited<ReturnType<typeof headers>>);
    jest.mocked(cookies).mockResolvedValue({ get: () => undefined } as unknown as Awaited<ReturnType<typeof cookies>>);
    jest.mocked(rateLimitIp).mockResolvedValue({ ok: true, retryAfter: 0 });
    jest.mocked(getMollie).mockReturnValue({ payments: { create: paymentsCreate } } as unknown as MollieClient);
    paymentsCreate.mockResolvedValue({ id: "tr_abc123", getCheckoutUrl: () => CHECKOUT_URL });
    db.product.findMany.mockResolvedValue([bed, lamp]);
    db.order.create.mockResolvedValue({ id: "order_1", orderNumber: "MOK-261012-ABCDE", publicToken: "tok123" });
    db.order.update.mockResolvedValue({});
    db.order.updateMany.mockResolvedValue({ count: 1 });
  });

  afterAll(() => {
    if (ORIGINAL_BASE_URL === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_BASE_URL;
  });

  describe("validatie (zod)", () => {
    it("weigert een ongeldige Nederlandse postcode met een leesbare melding", async () => {
      const result = await createCheckout(validInput({ customer: makeCustomer({ zipCode: "12345" }) }));
      expect(result).toEqual({ ok: false, error: "Ongeldige postcode (bv. 1234 AB)", message: "Ongeldige postcode (bv. 1234 AB)" });
      expect(rateLimitIp).not.toHaveBeenCalled();
      expect(db.order.create).not.toHaveBeenCalled();
    });

    it("weigert een ongeldige Belgische postcode", async () => {
      const result = await createCheckout(validInput({ customer: makeCustomer({ country: "BE", zipCode: "3511 AB" }) }));
      expect(result).toMatchObject({ ok: false, message: "Ongeldige postcode (4 cijfers)" });
    });

    it("accepteert 1234AB zonder spatie (NL) en 4 cijfers (BE)", async () => {
      expect((await createCheckout(validInput({ customer: makeCustomer({ zipCode: "3511ab" }) }))).ok).toBe(true);
      expect((await createCheckout(validInput({ customer: makeCustomer({ country: "BE", zipCode: "2000" }) }))).ok).toBe(true);
    });

    it.each([
      ["lege winkelwagen", { items: [] }],
      ["ongeldig e-mailadres", { customer: makeCustomer({ email: "geen-mail" }) }],
      ["te korte voornaam", { customer: makeCustomer({ firstName: "J" }) }],
      ["hoeveelheid 0", { items: [{ productId: "bed", quantity: 0 }] }],
      ["te veel nachtkasten", { items: [{ productId: "bed", quantity: 1, nachtkast: 3 }] }],
      ["onbekend land", { customer: makeCustomer({ country: "DE" }) }],
      ["ongeldige betaalmethode", { method: "ideal; drop" }],
      ["geen object", null],
    ])("weigert %s vóór rate-limit en database", async (_label, overrides) => {
      const input = overrides === null ? null : validInput(overrides as Record<string, unknown>);
      const result = await createCheckout(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
      expect(rateLimitIp).not.toHaveBeenCalled();
      expect(db.product.findMany).not.toHaveBeenCalled();
    });
  });

  it("weigert bij een overschreden rate-limit zonder order aan te maken", async () => {
    jest.mocked(rateLimitIp).mockResolvedValue({ ok: false, retryAfter: 60 });
    const result = await createCheckout(validInput());
    expect(result).toMatchObject({ ok: false, message: "Te veel pogingen. Wacht even en probeer opnieuw." });
    expect(rateLimitIp).toHaveBeenCalledWith("checkout", 15, 10 * 60 * 1000);
    expect(db.order.create).not.toHaveBeenCalled();
  });

  it("geeft de computeOrder-fout door bij een onbekend of uitverkocht product", async () => {
    db.product.findMany.mockResolvedValue([]);
    expect(await createCheckout(validInput())).toMatchObject({ ok: false, message: "Product niet (meer) beschikbaar" });

    db.product.findMany.mockResolvedValue([makeProduct({ ...bed, stock: 0 })]);
    expect(await createCheckout(validInput())).toMatchObject({ ok: false, message: "Bed Oslo is uitverkocht" });
    expect(db.order.create).not.toHaveBeenCalled();
  });

  it("geeft PRICE_CHANGED met het nieuwe bedrag als het getoonde subtotaal afwijkt", async () => {
    const result = await createCheckout(validInput({ expectedTotal: 549 }));
    expect(result).toEqual({
      ok: false,
      error: "PRICE_CHANGED",
      message: expect.stringContaining("gewijzigd"),
      subtotal: 599,
      total: 599,
    });
    expect(db.order.create).not.toHaveBeenCalled();
    expect(paymentsCreate).not.toHaveBeenCalled();
  });

  it("accepteert een kloppend expectedTotal (subtotaal excl. verzending)", async () => {
    db.product.findMany.mockResolvedValue([lamp]);
    const result = await createCheckout(validInput({ items: [{ productId: "lamp", quantity: 1 }], expectedTotal: 49.95 }));
    expect(result).toEqual({ ok: true, url: CHECKOUT_URL });
  });

  it("maakt de order en de Mollie-betaling aan met server-side bedragen", async () => {
    const result = await createCheckout(validInput({ method: "ideal" }));
    expect(result).toEqual({ ok: true, url: CHECKOUT_URL });

    expect(db.order.create).toHaveBeenCalledTimes(1);
    const createArgs = db.order.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArgs.data).toMatchObject({
      status: "open",
      total: 599,
      shipping: 0,
      firstName: "Jan",
      zipCode: "3511 AB",
      country: "NL",
      items: { create: [{ productId: "bed", productName: "Bed Oslo", quantity: 1, price: 599, variantLabel: null }] },
    });
    expect(createArgs.data.orderNumber).toMatch(/^MOK-\d{6}-[A-Z0-9]{5}$/);
    expect(createArgs.data.publicToken).toMatch(/^[0-9a-f]{32}$/);

    const payment = lastPaymentArgs();
    expect(payment).toMatchObject({
      amount: { currency: "EUR", value: "599.00" },
      description: `${businessInfo.name} — MOK-261012-ABCDE`,
      redirectUrl: "http://localhost:3000/checkout/afgerond?t=tok123",
      metadata: { orderId: "order_1", orderNumber: "MOK-261012-ABCDE" },
      method: "ideal",
    });
    // Lokaal (http/localhost) geen webhook, geen orderregels voor iDEAL.
    expect(payment).not.toHaveProperty("webhookUrl");
    expect(payment).not.toHaveProperty("lines");
    expect(payment).not.toHaveProperty("billingAddress");

    expect(db.order.update).toHaveBeenCalledWith({ where: { id: "order_1" }, data: { molliePaymentId: "tr_abc123" } });
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it("geeft de webhook-URL alleen mee bij een publieke https-basis", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://shop.example/";
    await createCheckout(validInput());
    expect(lastPaymentArgs()).toMatchObject({
      webhookUrl: "https://shop.example/api/webhooks/mollie",
      redirectUrl: "https://shop.example/checkout/afgerond?t=tok123",
    });
  });

  it("stuurt orderregels en factuuradres mee bij achteraf betalen, exact optellend tot het totaal", async () => {
    db.product.findMany.mockResolvedValue([lamp]);
    const result = await createCheckout(validInput({ method: "klarna", items: [{ productId: "lamp", quantity: 2 }] }));
    expect(result.ok).toBe(true);

    const payment = lastPaymentArgs() as {
      amount: { value: string };
      lines: Array<{ type: string; quantity: number; unitPrice: { value: string }; totalAmount: { value: string }; vatAmount: { value: string }; vatRate: string }>;
      billingAddress: Record<string, string>;
      shippingAddress: Record<string, string>;
    };
    const shippingCents = toCents(shippingInfo.rates.standard);
    expect(payment.amount.value).toBe(((2 * 4995 + shippingCents) / 100).toFixed(2));
    expect(payment.lines).toHaveLength(2);
    expect(payment.lines[0]).toMatchObject({ type: "physical", quantity: 2, unitPrice: { value: "49.95" }, totalAmount: { value: "99.90" }, vatRate: "21.00" });
    expect(payment.lines[1]).toMatchObject({ type: "shipping_fee", quantity: 1, totalAmount: { value: (shippingCents / 100).toFixed(2) } });

    const sumLines = payment.lines.reduce((s, l) => s + toCents(Number(l.totalAmount.value)), 0);
    expect(sumLines).toBe(toCents(Number(payment.amount.value)));
    for (const l of payment.lines) expect(toCents(Number(l.unitPrice.value)) * l.quantity).toBe(toCents(Number(l.totalAmount.value)));

    expect(payment.billingAddress).toEqual({
      givenName: "Jan",
      familyName: "Jansen",
      email: "jan@example.com",
      streetAndNumber: "Dorpsstraat 1",
      postalCode: "3511 AB",
      city: "Utrecht",
      country: "NL",
    });
    expect(payment.shippingAddress).toEqual(payment.billingAddress);
  });

  it("geeft een generieke melding en markeert de order failed als Mollie faalt", async () => {
    paymentsCreate.mockRejectedValue(new Error("Mollie says: invalid API key"));
    const result = await createCheckout(validInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/^De betaling kon niet worden gestart\./);
    expect(result.message).not.toContain("Mollie");
    expect(result.message).not.toContain("API key");
    expect(db.order.updateMany).toHaveBeenCalledWith({ where: { id: "order_1", status: "open" }, data: { status: "failed" } });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ scope: "createCheckout.mollie" }));
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it("markeert de order failed als Mollie geen checkout-URL geeft", async () => {
    paymentsCreate.mockResolvedValue({ id: "tr_abc123", getCheckoutUrl: () => null });
    const result = await createCheckout(validInput());
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("De betaling kon niet worden gestart") });
    expect(db.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "failed" } }));
  });

  it("geeft een generieke melding als de order niet opgeslagen kan worden", async () => {
    db.order.create.mockRejectedValue(new Error("P1001 kan database niet bereiken"));
    const result = await createCheckout(validInput());
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/^We konden je bestelling niet opslaan\./) });
    expect(paymentsCreate).not.toHaveBeenCalled();
  });

  it("laat een mislukte opslag van het payment-id de checkout niet breken (webhook synct via metadata)", async () => {
    db.order.update.mockRejectedValue(new Error("DB hik"));
    expect(await createCheckout(validInput())).toEqual({ ok: true, url: CHECKOUT_URL });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ scope: "createCheckout.savePaymentId" }));
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it("neemt de Google Ads click-id uit het formulier of de conversion-linker-cookie", async () => {
    await createCheckout(validInput({ gclid: "Cj0KCQjw_test_1234567890" }));
    expect((db.order.create.mock.calls[0][0] as { data: { gclid: string | null } }).data.gclid).toBe("Cj0KCQjw_test_1234567890");

    jest.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === "_gcl_aw" ? { name, value: "GCL.1700000000.CookieGclid_0123456789" } : undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    await createCheckout(validInput());
    expect((db.order.create.mock.calls[1][0] as { data: { gclid: string | null } }).data.gclid).toBe("CookieGclid_0123456789");
  });
});

describe("app/checkout/actions · getPaymentMethods", () => {
  it("geeft een lege lijst zonder bedrag en een vaste basislijst als Mollie onbereikbaar is", async () => {
    expect(await getPaymentMethods(0)).toEqual([]);
    const fallback = await getPaymentMethods(599);
    expect(fallback.map((m) => m.id)).toEqual(["ideal", "creditcard", "bancontact"]);
  });
});
