import {
  CATEGORIES,
  isCategorySlug,
  getCategory,
  dbCategoryToRouteSlug,
  productUrl,
  complementaryCategoryFor,
  categoryUrl,
} from "@/lib/categories";

describe("lib/categories", () => {
  it("heeft unieke slugs en voor elke umbrella meerdere DB-categorieën", () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CATEGORIES) {
      if (c.isUmbrella) expect(c.dbCategories.length).toBeGreaterThan(1);
      else expect(c.dbCategories).toEqual([c.slug]);
    }
  });

  describe("dbCategoryToRouteSlug", () => {
    it("geeft de slug terug voor een bekende categorie", () => {
      expect(dbCategoryToRouteSlug("hoekbanken")).toBe("hoekbanken");
      expect(dbCategoryToRouteSlug("banken")).toBe("banken");
      expect(dbCategoryToRouteSlug("tv-meubels")).toBe("tv-meubels");
    });

    it("geeft null voor een onbekende categorie (geen stille fallback)", () => {
      expect(dbCategoryToRouteSlug("onbekend")).toBeNull();
      expect(dbCategoryToRouteSlug("")).toBeNull();
      expect(dbCategoryToRouteSlug("Hoekbanken")).toBeNull();
    });
  });

  describe("productUrl", () => {
    it("bouwt /<categorie>/<slug>", () => {
      expect(productUrl({ category: "eettafels", slug: "rousseau-200" })).toBe("/eettafels/rousseau-200");
    });

    it("valt terug op de legacy-route zonder bekende categorie", () => {
      expect(productUrl({ category: "onbekend", slug: "x" })).toBe("/products/x");
    });
  });

  describe("complementaryCategoryFor", () => {
    it("koppelt eettafels aan eetkamerstoelen en banken aan salontafels", () => {
      expect(complementaryCategoryFor("eettafels")?.slug).toBe("eetkamerstoelen");
      expect(complementaryCategoryFor("eetkamerstoelen")?.slug).toBe("eettafels");
      expect(complementaryCategoryFor("hoekbanken")?.slug).toBe("salontafels");
      expect(complementaryCategoryFor("bedden")?.slug).toBe("nachtkastjes");
    });

    it("geeft null zonder aanvullende categorie", () => {
      expect(complementaryCategoryFor("spiegels")).toBeNull();
      expect(complementaryCategoryFor("onbekend")).toBeNull();
    });
  });

  describe("overige helpers", () => {
    it("isCategorySlug / getCategory / categoryUrl", () => {
      expect(isCategorySlug("spiegels")).toBe(true);
      expect(isCategorySlug("spiegel")).toBe(false);
      expect(getCategory("spiegels")?.label).toBe("Spiegels");
      expect(getCategory("nope")).toBeNull();
      expect(categoryUrl("spiegels")).toBe("/spiegels");
    });
  });
});
