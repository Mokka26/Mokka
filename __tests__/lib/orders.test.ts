import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { makeProduct, sizeVariantsJson } from "@/__tests__/helpers/fixtures";
import { prisma } from "@/lib/prisma";
import { shippingInfo } from "@/lib/shipping-info";
import { toCents, vatFromGrossCents } from "@/lib/money";
import { computeOrder, priceLine, generateOrderNumber, generatePublicToken } from "@/lib/orders";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));

const db = asPrismaMock(prisma);
const VAT = shippingInfo.vatRatePercent;
const STANDARD_SHIPPING_CENTS = toCents(shippingInfo.rates.standard);

const bed = makeProduct({
  id: "bed",
  name: "Bed Oslo",
  price: 599,
  stock: 5,
  sizeVariants: sizeVariantsJson([
    { label: "140 × 200", price: 599 },
    { label: "160 × 200", price: 699 },
  ]),
  nachtkastMode: "optional",
  nachtkastPrice: 89,
  nachtkastPrice2: 159,
});
const lamp = makeProduct({ id: "lamp", name: "Tafellamp Noor", category: "tafellampen", price: 49.95, stock: 3 });

describe("lib/orders", () => {
  describe("priceLine", () => {
    it("gebruikt de basisprijs zonder varianten", () => {
      expect(priceLine(lamp, {})).toEqual({ ok: true, unitCents: 4995, variantLabel: null, fullLabel: null });
    });

    it("neemt de variantprijs bij een gekozen maat", () => {
      expect(priceLine(bed, { variantLabel: "160 × 200" })).toEqual({
        ok: true,
        unitCents: 69900,
        variantLabel: "160 × 200",
        fullLabel: "160 × 200",
      });
    });

    it("weigert een maat die niet (meer) bestaat", () => {
      expect(priceLine(bed, { variantLabel: "180 × 200" })).toEqual({ ok: false, reason: "VARIANT_MISSING" });
    });

    it("valt op de basisprijs terug als er varianten zijn maar geen maat gekozen is", () => {
      expect(priceLine(bed, {})).toMatchObject({ ok: true, unitCents: 59900 });
    });

    it("telt nachtkasten alleen bij modus optional, met prijs uit de DB en max 2", () => {
      expect(priceLine(bed, { variantLabel: "140 × 200", nachtkast: 1 })).toMatchObject({
        unitCents: 59900 + 8900,
        fullLabel: "140 × 200 · 1 nachtkast",
      });
      expect(priceLine(bed, { variantLabel: "140 × 200", nachtkast: 2 })).toMatchObject({
        unitCents: 59900 + 15900,
        fullLabel: "140 × 200 · 2 nachtkasten",
      });
      expect(priceLine(bed, { nachtkast: 5 })).toMatchObject({ unitCents: 59900 + 15900 });
      expect(priceLine(bed, { nachtkast: -1 })).toMatchObject({ unitCents: 59900 });
    });

    it("rekent twee nachtkasten als 2 × enkelprijs zonder nachtkastPrice2", () => {
      const p = makeProduct({ ...bed, nachtkastPrice2: null });
      expect(priceLine(p, { nachtkast: 2 })).toMatchObject({ unitCents: 59900 + 2 * 8900 });
    });

    it("geeft geen toeslag bij nachtkastMode included of none", () => {
      expect(priceLine(makeProduct({ ...bed, nachtkastMode: "included" }), { nachtkast: 2 })).toMatchObject({
        unitCents: 59900,
        fullLabel: null,
      });
      expect(priceLine(makeProduct({ ...bed, nachtkastMode: null }), { nachtkast: 1 })).toMatchObject({ unitCents: 59900 });
    });

    it("telt een voetbank alleen bij modus optional", () => {
      const p = makeProduct({ ...bed, voetbankMode: "optional", voetbankPrice: 129 });
      expect(priceLine(p, { voetbank: 1 })).toMatchObject({ unitCents: 59900 + 12900, fullLabel: "voetbank" });
      expect(priceLine(p, { voetbank: 3 })).toMatchObject({ unitCents: 59900 + 12900 });
      expect(priceLine(makeProduct({ ...p, voetbankMode: "included" }), { voetbank: 1 })).toMatchObject({ unitCents: 59900 });
    });

    it("weigert een product zonder geldige prijs", () => {
      expect(priceLine(makeProduct({ price: 0 }), {})).toEqual({ ok: false, reason: "NO_PRICE" });
    });

    it("negeert kapotte sizeVariants-JSON en gebruikt de basisprijs", () => {
      expect(priceLine(makeProduct({ sizeVariants: "{niet json" }), { variantLabel: "x" })).toMatchObject({ unitCents: 59900 });
    });
  });

  describe("computeOrder", () => {
    it("weigert een lege winkelwagen zonder de database te raken", async () => {
      await expect(computeOrder([])).rejects.toThrow("Lege winkelwagen");
      expect(db.product.findMany).not.toHaveBeenCalled();
    });

    it("vraagt alleen zichtbare, niet-verwijderde producten op", async () => {
      db.product.findMany.mockResolvedValue([lamp]);
      await computeOrder([{ productId: "lamp", quantity: 1 }]);
      expect(db.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["lamp"] }, hidden: false, deletedAt: null } }),
      );
    });

    it("gooit bij een onbekend, verborgen of verwijderd product", async () => {
      db.product.findMany.mockResolvedValue([]);
      await expect(computeOrder([{ productId: "weg", quantity: 1 }])).rejects.toThrow("Product niet (meer) beschikbaar");
    });

    it("gooit bij voorraad 0", async () => {
      db.product.findMany.mockResolvedValue([makeProduct({ ...lamp, stock: 0 })]);
      await expect(computeOrder([{ productId: "lamp", quantity: 1 }])).rejects.toThrow("Tafellamp Noor is uitverkocht");
    });

    it("gooit als de regel meer vraagt dan de voorraad", async () => {
      db.product.findMany.mockResolvedValue([lamp]);
      await expect(computeOrder([{ productId: "lamp", quantity: 4 }])).rejects.toThrow("Tafellamp Noor: nog 3 op voorraad");
    });

    it("aggregeert hetzelfde product over meerdere regels voor de voorraadcheck", async () => {
      db.product.findMany.mockResolvedValue([bed]);
      await expect(
        computeOrder([
          { productId: "bed", variantLabel: "140 × 200", quantity: 3 },
          { productId: "bed", variantLabel: "160 × 200", quantity: 3 },
        ]),
      ).rejects.toThrow("Bed Oslo: nog 5 op voorraad");
    });

    it("gooit bij een onbekende maat-variant", async () => {
      db.product.findMany.mockResolvedValue([bed]);
      await expect(computeOrder([{ productId: "bed", variantLabel: "200 × 200", quantity: 1 }])).rejects.toThrow(
        "De gekozen maat voor Bed Oslo is niet meer beschikbaar",
      );
    });

    it("prijst de variant plus nachtkast-optie uit de database, niet uit de client", async () => {
      db.product.findMany.mockResolvedValue([bed]);
      const order = await computeOrder([{ productId: "bed", variantLabel: "160 × 200", nachtkast: 2, quantity: 1 }]);
      expect(order.lines).toHaveLength(1);
      expect(order.lines[0]).toMatchObject({
        productId: "bed",
        productName: "Bed Oslo",
        variantLabel: "160 × 200 · 2 nachtkasten",
        quantity: 1,
        unitCents: 69900 + 15900,
        totalCents: 85800,
        price: 858,
      });
    });

    it("geeft gratis verzending boven de drempel in NL en BE", async () => {
      db.product.findMany.mockResolvedValue([bed]);
      const nl = await computeOrder([{ productId: "bed", quantity: 1 }], "NL");
      const be = await computeOrder([{ productId: "bed", quantity: 1 }], "BE");
      expect(nl.shippingCents).toBe(0);
      expect(be.shippingCents).toBe(0);
      expect(nl.totalCents).toBe(59900);
      expect(nl.country).toBe("NL");
    });

    it("rekent het standaardtarief onder de drempel en buiten NL/BE", async () => {
      db.product.findMany.mockResolvedValue([lamp]);
      const under = await computeOrder([{ productId: "lamp", quantity: 1 }]);
      expect(under.subtotalCents).toBe(4995);
      expect(under.shippingCents).toBe(STANDARD_SHIPPING_CENTS);
      expect(under.totalCents).toBe(4995 + STANDARD_SHIPPING_CENTS);
      expect(under.shipping).toBe(shippingInfo.rates.standard);

      db.product.findMany.mockResolvedValue([bed]);
      const abroad = await computeOrder([{ productId: "bed", quantity: 1 }], "DE");
      expect(abroad.shippingCents).toBe(STANDARD_SHIPPING_CENTS);
    });

    it("geeft precies op de drempel gratis verzending", async () => {
      db.product.findMany.mockResolvedValue([makeProduct({ id: "p", price: shippingInfo.freeShippingThreshold, stock: 1 })]);
      const order = await computeOrder([{ productId: "p", quantity: 1 }]);
      expect(order.shippingCents).toBe(0);
    });

    it("laat centen exact optellen: regels + verzending = totaal, btw per regel + verzend-btw = btw", async () => {
      db.product.findMany.mockResolvedValue([bed, lamp]);
      const order = await computeOrder([
        { productId: "bed", variantLabel: "140 × 200", nachtkast: 1, quantity: 2 },
        { productId: "lamp", quantity: 3 },
      ]);
      const sumLines = order.lines.reduce((s, l) => s + l.totalCents, 0);
      const sumVat = order.lines.reduce((s, l) => s + l.vatCents, 0);
      expect(order.subtotalCents).toBe(sumLines);
      expect(order.subtotalCents).toBe(2 * (59900 + 8900) + 3 * 4995);
      expect(order.subtotalCents + order.shippingCents).toBe(order.totalCents);
      expect(order.vatCents).toBe(sumVat + vatFromGrossCents(order.shippingCents, VAT));
      for (const l of order.lines) {
        expect(l.totalCents).toBe(l.unitCents * l.quantity);
        expect(l.vatCents).toBe(vatFromGrossCents(l.totalCents, VAT));
        expect(Number.isInteger(l.vatCents)).toBe(true);
      }
      expect(order.subtotal).toBe(order.subtotalCents / 100);
      expect(order.total).toBe(order.totalCents / 100);
    });

    it("klemt de hoeveelheid tussen 1 en 99", async () => {
      db.product.findMany.mockResolvedValue([makeProduct({ id: "p", stock: 500 })]);
      const zero = await computeOrder([{ productId: "p", quantity: 0 }]);
      expect(zero.lines[0].quantity).toBe(1);
      const huge = await computeOrder([{ productId: "p", quantity: 1000 }]);
      expect(huge.lines[0].quantity).toBe(99);
    });
  });

  describe("generateOrderNumber", () => {
    it("heeft het formaat MOK-YYMMDD-XXXXX met de gegeven datum", () => {
      const now = new Date(2026, 9, 12, 12, 0, 0).getTime(); // lokale tijd, 12 oktober 2026
      expect(generateOrderNumber(now)).toMatch(/^MOK-261012-[A-Z0-9]{5}$/);
    });

    it("gebruikt nooit 0, O, 1, I of L in het willekeurige deel", () => {
      for (let i = 0; i < 300; i++) {
        const rand = generateOrderNumber().split("-")[2];
        expect(rand).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
      }
    });

    it("geeft verschillende nummers per aanroep", () => {
      const set = new Set(Array.from({ length: 50 }, () => generateOrderNumber()));
      expect(set.size).toBe(50);
    });
  });

  describe("generatePublicToken", () => {
    it("geeft 32 hex-tekens en is niet voorspelbaar", () => {
      const a = generatePublicToken();
      const b = generatePublicToken();
      expect(a).toMatch(/^[0-9a-f]{32}$/);
      expect(b).toMatch(/^[0-9a-f]{32}$/);
      expect(a).not.toBe(b);
    });
  });
});
