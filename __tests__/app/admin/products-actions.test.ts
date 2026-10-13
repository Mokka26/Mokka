import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { asPrismaMock, createTxMock, useTransaction } from "@/__tests__/helpers/prisma-mock";
import { makeProduct, IMAGE_URL } from "@/__tests__/helpers/fixtures";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidateProduct, revalidateAllProducts } from "@/lib/revalidate";
import {
  updateProductInline,
  bulkUpdateProducts,
  updateProductFull,
  updateProductImages,
  softDeleteProductImage,
  type FullUpdateState,
} from "@/app/admin/(protected)/products/actions";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/cloudinary", () => ({ cloudinary: { utils: { api_sign_request: jest.fn() } } }));
jest.mock("@/lib/revalidate", () => ({ revalidateProduct: jest.fn(), revalidateAllProducts: jest.fn() }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const db = asPrismaMock(prisma);
// NextAuth's `auth` is overbelast getypeerd; één cast naar een gewone jest.Mock.
const authMock = auth as unknown as jest.Mock;
const SESSION = { user: { id: "admin_1", email: "admin@example.com" } };

/** Volledig, geldig bewerkformulier; overschrijf per test. */
function fullForm(overrides: Record<string, string> = {}): FormData {
  const fields: Record<string, string> = {
    id: "prod_1",
    updatedAt: "2026-01-15T10:00:00.000Z",
    slug: "bed-oslo",
    name: "Bed Oslo",
    description: "Een rustig bed van massief eikenhout.",
    price: "599",
    listPrice: "",
    nachtkastMode: "",
    nachtkastPrice: "",
    nachtkastPrice2: "",
    voetbankMode: "",
    voetbankPrice: "",
    category: "bedden",
    stock: "10",
    deliveryTime: "2-3 werkdagen",
    colorGroup: "",
    colorName: "",
    colorHex: "",
    source: "",
    specs: "",
    sizeVariants: "",
    ...overrides,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const notFoundError = () =>
  new Prisma.PrismaClientKnownRequestError("Record to update not found.", { code: "P2025", clientVersion: "test" });

describe("app/admin/products/actions", () => {
  let tx: ReturnType<typeof createTxMock>;

  beforeEach(() => {
    authMock.mockResolvedValue(SESSION);
    tx = createTxMock();
    useTransaction(db, tx);
    tx.product.updateMany.mockResolvedValue({ count: 0 });
  });

  it("weigert alle acties zonder sessie", async () => {
    authMock.mockResolvedValue(null);
    expect(await updateProductInline({ id: "prod_1", price: 10 })).toEqual({ ok: false, error: "Niet ingelogd" });
    expect(await bulkUpdateProducts({ action: "hide", ids: ["prod_1"] })).toEqual({ ok: false, error: "Niet ingelogd" });
    expect(await updateProductFull({}, fullForm())).toEqual({ error: "Niet ingelogd" });
    expect(db.product.findUnique).not.toHaveBeenCalled();
  });

  describe("updateProductInline · publicatieblokkade", () => {
    it("weigert prijs 0 op een ZICHTBAAR product (zou onverkoopbaar in de winkel staan)", async () => {
      db.product.findUnique.mockResolvedValue(makeProduct({ hidden: false, price: 599 }));
      const result = await updateProductInline({ id: "prod_1", price: 0 });
      expect(result).toEqual({ ok: false, error: expect.stringContaining("zichtbaar") });
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(revalidateProduct).not.toHaveBeenCalled();
    });

    it("staat prijs 0 toe op een verborgen product", async () => {
      db.product.findUnique.mockResolvedValue(makeProduct({ hidden: true }));
      tx.product.update.mockResolvedValue({});
      expect(await updateProductInline({ id: "prod_1", price: 0 })).toEqual({ ok: true });
      expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "prod_1" }, data: { price: 0 } });
      expect(revalidateProduct).toHaveBeenCalledWith(expect.objectContaining({ slug: "bed-oslo", category: "bedden" }));
    });

    it("staat prijs 0 toe op een zichtbaar product waarvan elke maat een eigen prijs heeft", async () => {
      db.product.findUnique.mockResolvedValue(
        makeProduct({ hidden: false, sizeVariants: JSON.stringify([{ label: "140 × 200", price: 599 }, { label: "160 × 200", price: 699 }]) }),
      );
      tx.product.update.mockResolvedValue({});
      expect(await updateProductInline({ id: "prod_1", price: 0 })).toEqual({ ok: true });
    });

    it("weigert zichtbaar maken zonder foto of zonder prijs, met de reden", async () => {
      db.product.findUnique.mockResolvedValue(makeProduct({ hidden: true, images: "[]", price: 0 }));
      const result = await updateProductInline({ id: "prod_1", hidden: false });
      expect(result).toEqual({ ok: false, error: expect.stringContaining("geen prijs, geen foto") });
    });

    it("laat verbergen altijd toe en werkt de prijs van de kleurgroep mee bij", async () => {
      db.product.findUnique.mockResolvedValue(makeProduct({ hidden: false, colorGroup: "oslo", images: "[]" }));
      tx.product.update.mockResolvedValue({});
      db.product.findMany.mockResolvedValue([{ slug: "bed-oslo-zwart", category: "bedden" }]);
      expect(await updateProductInline({ id: "prod_1", hidden: true, price: 649 })).toEqual({ ok: true });
      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { colorGroup: "oslo", deletedAt: null, id: { not: "prod_1" } },
        data: { price: 649 },
      });
      expect(revalidateProduct).toHaveBeenCalledWith({ slug: "bed-oslo-zwart", category: "bedden" });
    });

    it("weigert ongeldige invoer (negatieve voorraad) en een onbekend product", async () => {
      expect(await updateProductInline({ id: "prod_1", stock: -1 })).toEqual({ ok: false, error: "Voorraad kan niet negatief zijn" });
      db.product.findUnique.mockResolvedValue(null);
      expect(await updateProductInline({ id: "weg", price: 10 })).toEqual({ ok: false, error: "Product niet gevonden" });
    });
  });

  describe("bulkUpdateProducts · prijs", () => {
    it("slaat zichtbare producten over waarvan de nieuwe prijs 0 zou worden, en past de rest toe", async () => {
      db.product.findMany.mockResolvedValue([
        makeProduct({ id: "zichtbaar", name: "Zichtbaar", hidden: false, price: 100 }),
        makeProduct({ id: "verborgen", name: "Verborgen", hidden: true, price: 100 }),
      ]);
      db.product.update.mockReturnValue(Promise.resolve({}) as unknown as Prisma.PrismaPromise<unknown>);
      db.$transaction.mockResolvedValue([]);

      const result = await bulkUpdateProducts({ action: "price", ids: ["zichtbaar", "verborgen"], mode: "absolute", amount: 0 });
      expect(result).toMatchObject({ ok: true, changed: 1, refused: [{ name: "Zichtbaar", reasons: [expect.stringContaining("zichtbaar")] }] });
      expect(db.product.update).toHaveBeenCalledTimes(1);
      expect(db.product.update).toHaveBeenCalledWith({ where: { id: "verborgen" }, data: { price: 0 } });
      expect(revalidateAllProducts).toHaveBeenCalledTimes(1);
    });

    it("past een procentuele verhoging toe, afgerond op centen", async () => {
      db.product.findMany.mockResolvedValue([makeProduct({ id: "a", hidden: false, price: 99.99 })]);
      db.product.update.mockReturnValue(Promise.resolve({}) as unknown as Prisma.PrismaPromise<unknown>);
      db.$transaction.mockResolvedValue([]);
      expect(await bulkUpdateProducts({ action: "price", ids: ["a"], mode: "percent", amount: 10 })).toMatchObject({ ok: true, changed: 1 });
      expect(db.product.update).toHaveBeenCalledWith({ where: { id: "a" }, data: { price: 109.99 } });
    });

    it("weigert bij 'show' producten zonder prijs of foto en maakt de rest zichtbaar", async () => {
      db.product.findMany.mockResolvedValue([
        makeProduct({ id: "ok", name: "Compleet" }),
        makeProduct({ id: "leeg", name: "Zonder foto", images: "[]" }),
      ]);
      db.product.updateMany.mockResolvedValue({ count: 1 });
      const result = await bulkUpdateProducts({ action: "show", ids: ["ok", "leeg"] });
      expect(result).toMatchObject({ ok: true, changed: 1, refused: [{ name: "Zonder foto", reasons: ["geen foto"] }] });
      expect(db.product.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["ok"] } }, data: { hidden: false } });
    });
  });

  describe("updateProductFull", () => {
    const existing = { slug: "bed-oslo", category: "bedden", images: JSON.stringify([{ url: IMAGE_URL }]), colorGroup: null };

    it("geeft een conflictmelding als het product intussen gewijzigd is (optimistic lock op updatedAt)", async () => {
      db.product.findUnique.mockResolvedValueOnce(existing);
      tx.product.update.mockRejectedValue(notFoundError());
      const result = await updateProductFull({}, fullForm());
      expect(result).toEqual({ error: "Dit product is intussen elders gewijzigd. Herlaad de pagina." });
      expect(tx.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "prod_1", updatedAt: new Date("2026-01-15T10:00:00.000Z") } }),
      );
      expect(revalidateProduct).not.toHaveBeenCalled();
    });

    it("slaat op, geeft de nieuwe updatedAt terug en ververst de pagina's", async () => {
      db.product.findUnique.mockResolvedValueOnce(existing);
      const savedAt = new Date("2026-02-01T12:00:00.000Z");
      tx.product.update.mockResolvedValue({ slug: "bed-oslo", category: "bedden", colorGroup: null, updatedAt: savedAt });
      const result = await updateProductFull({}, fullForm({ price: "649,50", specs: JSON.stringify({ Materiaal: "Eikenhout" }) }));
      expect(result).toEqual({ ok: true, savedAt: expect.any(Number), updatedAt: savedAt.toISOString() });
      const args = tx.product.update.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(args.data).toMatchObject({ price: 649.5, hidden: false, specs: JSON.stringify({ Materiaal: "Eikenhout" }), sizeVariants: null });
      expect(tx.slugRedirect.upsert).not.toHaveBeenCalled();
      expect(revalidateProduct).toHaveBeenCalledWith({ slug: "bed-oslo", category: "bedden", colorGroup: null, updatedAt: savedAt }, undefined);
    });

    it("legt bij een slug-wijziging een SlugRedirect vast, ruimt een tegengestelde redirect op en stuurt door", async () => {
      db.product.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(null); // geen clash
      tx.product.update.mockResolvedValue({ slug: "bed-oslo-eiken", category: "bedden", colorGroup: null, updatedAt: new Date() });
      await expect(updateProductFull({}, fullForm({ slug: "Bed Oslo Eiken" }))).rejects.toThrow("NEXT_REDIRECT:/admin/products/bed-oslo-eiken?saved=1");
      expect(tx.slugRedirect.deleteMany).toHaveBeenCalledWith({ where: { oldSlug: "bed-oslo-eiken" } });
      expect(tx.slugRedirect.upsert).toHaveBeenCalledWith({
        where: { oldSlug: "bed-oslo" },
        create: { oldSlug: "bed-oslo", productId: "prod_1" },
        update: { productId: "prod_1" },
      });
      expect(revalidateProduct).toHaveBeenCalledWith(expect.objectContaining({ slug: "bed-oslo-eiken" }), { slug: "bed-oslo", category: "bedden" });
      expect(redirect).toHaveBeenCalledWith("/admin/products/bed-oslo-eiken?saved=1");
    });

    it("weigert een slug die al door een ander product gebruikt wordt", async () => {
      db.product.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce({ id: "ander" });
      const result = await updateProductFull({}, fullForm({ slug: "bestaande-slug" }));
      expect(result).toEqual({ fieldErrors: { slug: "Deze URL is al in gebruik door een ander product" } });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("weigert zichtbaar opslaan zonder foto (veldfout op 'hidden')", async () => {
      db.product.findUnique.mockResolvedValueOnce({ ...existing, images: "[]" });
      const result = (await updateProductFull({}, fullForm())) as FullUpdateState;
      expect(result.fieldErrors?.hidden).toContain("geen foto");
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("maakt van onleesbare prijzen veldfouten in plaats van stil terug te vallen", async () => {
      const result = (await updateProductFull({}, fullForm({ price: "abc", listPrice: "10" }))) as FullUpdateState;
      expect(result.fieldErrors?.price).toBeTruthy();
      expect(db.product.findUnique).not.toHaveBeenCalled();
      const lower = (await updateProductFull({}, fullForm({ price: "599", listPrice: "500" }))) as FullUpdateState;
      expect(lower.fieldErrors?.listPrice).toContain("hoger");
    });
  });

  describe("foto's · laatste foto van een zichtbaar product", () => {
    it("updateProductImages weigert een lege lijst voor een zichtbaar product", async () => {
      db.product.findUnique.mockResolvedValue({ name: "Bed Oslo", hidden: false });
      expect(await updateProductImages({ id: "prod_1", images: [] })).toEqual({ ok: false, error: expect.stringContaining("minstens één foto") });
      expect(db.product.update).not.toHaveBeenCalled();
    });

    it("updateProductImages staat een lege lijst toe voor een verborgen product", async () => {
      db.product.findUnique.mockResolvedValue({ name: "Bed Oslo", hidden: true });
      db.product.update.mockResolvedValue({ slug: "bed-oslo", category: "bedden" });
      expect(await updateProductImages({ id: "prod_1", images: [] })).toEqual({ ok: true });
      expect(db.product.update).toHaveBeenCalledWith({ where: { id: "prod_1" }, data: { images: "[]" }, select: { slug: true, category: true } });
    });

    it("softDeleteProductImage weigert de laatste foto van een zichtbaar product", async () => {
      db.product.findUnique.mockResolvedValue(makeProduct({ hidden: false }));
      const result = await softDeleteProductImage({ productId: "prod_1", url: IMAGE_URL });
      expect(result).toEqual({ ok: false, error: expect.stringContaining("laatste foto") });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("softDeleteProductImage verplaatst een niet-laatste foto naar de prullenbak", async () => {
      const other = "https://res.cloudinary.com/mokka/image/upload/v1/test/bed-oslo-2.jpg";
      db.product.findUnique.mockResolvedValue(makeProduct({ hidden: false, images: JSON.stringify([{ url: IMAGE_URL }, { url: other }]) }));
      db.deletedImage.create.mockReturnValue(Promise.resolve({}) as unknown as Prisma.PrismaPromise<unknown>);
      db.product.update.mockReturnValue(Promise.resolve({}) as unknown as Prisma.PrismaPromise<unknown>);
      db.$transaction.mockResolvedValue([]);
      expect(await softDeleteProductImage({ productId: "prod_1", url: IMAGE_URL })).toEqual({ ok: true });
      expect(db.deletedImage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ productId: "prod_1", productSlug: "bed-oslo", publicId: "test/bed-oslo", url: IMAGE_URL }),
      });
      expect(db.product.update).toHaveBeenCalledWith({ where: { id: "prod_1" }, data: { images: JSON.stringify([{ url: other }]) } });
    });
  });
});
