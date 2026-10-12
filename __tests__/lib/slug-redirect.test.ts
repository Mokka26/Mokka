import { asPrismaMock } from "@/__tests__/helpers/prisma-mock";
import { prisma } from "@/lib/prisma";
import { findRedirectTarget } from "@/lib/slug-redirect";

jest.mock("@/lib/prisma", () => ({
  prisma: jest
    .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
    .createPrismaMock(),
}));

const db = asPrismaMock(prisma);

describe("lib/slug-redirect · findRedirectTarget", () => {
  it("geeft de canonieke URL van het zichtbare product", async () => {
    db.slugRedirect.findUnique.mockResolvedValue({ productId: "prod_1" });
    db.product.findFirst.mockResolvedValue({ slug: "eettafel-rousseau", category: "eettafels" });

    expect(await findRedirectTarget("oude-slug")).toEqual({
      slug: "eettafel-rousseau",
      category: "eettafels",
      url: "/eettafels/eettafel-rousseau",
    });
    expect(db.slugRedirect.findUnique).toHaveBeenCalledWith({ where: { oldSlug: "oude-slug" }, select: { productId: true } });
    expect(db.product.findFirst).toHaveBeenCalledWith({
      where: { id: "prod_1", hidden: false, deletedAt: null },
      select: { slug: true, category: true },
    });
  });

  it("geeft null zonder redirect-rij en zoekt dan geen product", async () => {
    db.slugRedirect.findUnique.mockResolvedValue(null);
    expect(await findRedirectTarget("niets")).toBeNull();
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });

  it("geeft null als het product verborgen of verwijderd is", async () => {
    db.slugRedirect.findUnique.mockResolvedValue({ productId: "prod_1" });
    db.product.findFirst.mockResolvedValue(null);
    expect(await findRedirectTarget("oude-slug")).toBeNull();
  });

  it("geeft null als de redirect naar zichzelf zou wijzen", async () => {
    db.slugRedirect.findUnique.mockResolvedValue({ productId: "prod_1" });
    db.product.findFirst.mockResolvedValue({ slug: "oude-slug", category: "eettafels" });
    expect(await findRedirectTarget("oude-slug")).toBeNull();
  });

  it("geeft null als de categorie geen route heeft (anders redirect naar 404)", async () => {
    db.slugRedirect.findUnique.mockResolvedValue({ productId: "prod_1" });
    db.product.findFirst.mockResolvedValue({ slug: "x", category: "onbekend" });
    expect(await findRedirectTarget("oude-slug")).toBeNull();
  });
});
