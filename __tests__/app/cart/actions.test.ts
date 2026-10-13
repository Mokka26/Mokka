import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { makeProduct, sizeVariantsJson, IMAGE_URL } from "@/__tests__/helpers/fixtures";
import { prisma } from "@/lib/prisma";
import { rateLimitIp } from "@/lib/rate-limit";
import { getCartSnapshot } from "@/app/cart/actions";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/lib/rate-limit", () => ({ rateLimitIp: jest.fn() }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));

const db = asPrismaMock(prisma);

describe("app/cart/actions · getCartSnapshot", () => {
  beforeEach(() => {
    jest.mocked(rateLimitIp).mockResolvedValue({ ok: true, retryAfter: 0 });
  });

  it("geeft per regel de actuele prijs (maat + opties), voorraad en foto, in inputvolgorde", async () => {
    db.product.findMany.mockResolvedValue([
      makeProduct({ id: "bed", price: 599, stock: 3, sizeVariants: sizeVariantsJson([{ label: "160 × 200", price: 699 }]), nachtkastMode: "optional", nachtkastPrice: 89 }),
      makeProduct({ id: "lamp", slug: "lamp-noor", name: "Lamp Noor", category: "tafellampen", price: 49.95, stock: 0 }),
    ]);
    const lines = await getCartSnapshot([
      { productId: "lamp" },
      { productId: "bed", variantLabel: "160 × 200", nachtkast: 1 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ available: true, variantValid: true, productId: "lamp", slug: "lamp-noor", price: 49.95, stock: 0, image: IMAGE_URL });
    expect(lines[1]).toMatchObject({
      key: { productId: "bed", variantLabel: "160 × 200", nachtkast: 1, voetbank: 0 },
      available: true,
      variantValid: true,
      price: 788,
      basePrice: 599,
      label: "160 × 200 · 1 nachtkast",
    });
  });

  it("geeft voor een verborgen of verwijderd product alléén { key, available: false } — geen naam, slug of foto", async () => {
    db.product.findMany.mockResolvedValue([
      makeProduct({ id: "verborgen", hidden: true }),
      makeProduct({ id: "weg", deletedAt: new Date() }),
    ]);
    const lines = await getCartSnapshot([{ productId: "verborgen" }, { productId: "weg" }, { productId: "onbekend" }]);
    for (const line of lines) {
      expect(line.available).toBe(false);
      expect(line).toMatchObject({ productId: null, slug: null, name: null, category: null, image: null, price: null, basePrice: null, listPrice: null, stock: 0, label: null });
    }
    expect(lines[0].key).toEqual({ productId: "verborgen", variantLabel: null, nachtkast: 0, voetbank: 0 });
  });

  it("markeert een verdwenen maat als variantValid: false zonder prijs", async () => {
    db.product.findMany.mockResolvedValue([makeProduct({ id: "bed", sizeVariants: sizeVariantsJson([{ label: "140 × 200", price: 599 }]) })]);
    const [line] = await getCartSnapshot([{ productId: "bed", variantLabel: "200 × 200" }]);
    expect(line).toMatchObject({ available: true, variantValid: false, price: null, basePrice: 599, name: "Bed Oslo" });
  });

  it("is per IP begrensd (60/min) en geeft dan een lege lijst", async () => {
    jest.mocked(rateLimitIp).mockResolvedValue({ ok: false, retryAfter: 30 });
    expect(await getCartSnapshot([{ productId: "bed" }])).toEqual([]);
    expect(rateLimitIp).toHaveBeenCalledWith("cart-snapshot", 60, 60_000);
    expect(db.product.findMany).not.toHaveBeenCalled();
  });

  it("geeft een lege lijst bij ongeldige invoer, lege invoer of een DB-fout", async () => {
    expect(await getCartSnapshot([])).toEqual([]);
    expect(await getCartSnapshot([{ nachtkast: 1 }] as never)).toEqual([]);
    db.product.findMany.mockRejectedValue(new Error("DB weg"));
    expect(await getCartSnapshot([{ productId: "bed" }])).toEqual([]);
  });
});
