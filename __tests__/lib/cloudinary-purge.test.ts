import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { captureError } from "@/lib/sentry";
import { collectReferencedCloudinaryIds, destroyCloudinaryAssets, publicIdsFromImages } from "@/lib/cloudinary-purge";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));
jest.mock("@/lib/cloudinary", () => ({ cloudinary: { uploader: { destroy: jest.fn() } } }));
jest.mock("@/lib/sentry", () => ({ captureError: jest.fn(), captureWarning: jest.fn() }));

const db = asPrismaMock(prisma);
const destroy = jest.mocked(cloudinary.uploader.destroy);
const url = (id: string) => `https://res.cloudinary.com/mokka/image/upload/v1/${id}.jpg`;

describe("lib/cloudinary-purge", () => {
  beforeEach(() => {
    destroy.mockResolvedValue({ result: "ok" } as never);
  });

  it("publicIdsFromImages: uniek, alleen Cloudinary-URL's, beide opslagformaten", () => {
    const json = JSON.stringify([url("mokka/a"), { url: url("mokka/b") }, { url: url("mokka/a") }, { url: "https://elders.example/x.jpg" }]);
    expect(publicIdsFromImages(json)).toEqual(["mokka/a", "mokka/b"]);
    expect(publicIdsFromImages(null)).toEqual([]);
    expect(publicIdsFromImages("kapot")).toEqual([]);
  });

  it("collectReferencedCloudinaryIds: alle producten (ook verborgen/prullenbak), met uitsluiting", async () => {
    db.product.findMany.mockResolvedValue([{ images: JSON.stringify([{ url: url("mokka/a") }]) }, { images: JSON.stringify([url("mokka/b")]) }]);
    expect([...(await collectReferencedCloudinaryIds())].sort()).toEqual(["mokka/a", "mokka/b"]);
    expect(db.product.findMany).toHaveBeenCalledWith({ where: {}, select: { images: true } });
    await collectReferencedCloudinaryIds(["p1"]);
    expect(db.product.findMany).toHaveBeenLastCalledWith({ where: { id: { notIn: ["p1"] } }, select: { images: true } });
  });

  it("vernietigt nooit een asset die nog door een ander product gebruikt wordt (gedeelde kleurvariant-foto)", async () => {
    db.product.findMany.mockResolvedValue([{ images: JSON.stringify([{ url: url("mokka/gedeeld") }]) }]);
    const result = await destroyCloudinaryAssets(["mokka/gedeeld", "mokka/eigen", "mokka/eigen"], { context: "test" });
    expect(result).toEqual({ destroyed: 1, skippedReferenced: 1, failed: 0 });
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledWith("mokka/eigen", { invalidate: true });
  });

  it("gebruikt een meegegeven referenced-set zonder extra query", async () => {
    await destroyCloudinaryAssets(["mokka/x"], { context: "test", referenced: new Set(["mokka/x"]) });
    expect(db.product.findMany).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  it("vernietigt niets als de referenced-set niet opgehaald kan worden (fail safe)", async () => {
    db.product.findMany.mockRejectedValue(new Error("DB weg"));
    expect(await destroyCloudinaryAssets(["mokka/x"], { context: "test" })).toEqual({ destroyed: 0, skippedReferenced: 0, failed: 1 });
    expect(destroy).not.toHaveBeenCalled();
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { scope: "test:cloudinary.referenced" });
  });

  it("telt een mislukte destroy als fout en gaat door met de rest", async () => {
    db.product.findMany.mockResolvedValue([]);
    destroy.mockRejectedValueOnce(new Error("Cloudinary 500")).mockResolvedValueOnce({ result: "ok" } as never);
    expect(await destroyCloudinaryAssets(["mokka/a", "mokka/b"], { context: "test" })).toEqual({ destroyed: 1, skippedReferenced: 0, failed: 1 });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { scope: "test:cloudinary.destroy", publicId: "mokka/a" });
  });

  it("doet niets bij een lege lijst", async () => {
    expect(await destroyCloudinaryAssets([], { context: "test" })).toEqual({ destroyed: 0, skippedReferenced: 0, failed: 0 });
    expect(db.product.findMany).not.toHaveBeenCalled();
  });
});
