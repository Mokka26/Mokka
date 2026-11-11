import {
  buildVariantOptions,
  compareSizes,
  distinctColors,
  distinctSizes,
  formatSizeList,
  inStockFirst,
  onePerModel,
  primaryVariantSlugs,
  swatchBackground,
  type ModelVariant,
} from "@/lib/variants";

const v = (slug: string, sizeName: string | null, colorName: string | null, price: number, stock = 5): ModelVariant => ({
  id: slug,
  slug,
  sizeName,
  colorName,
  colorHex: colorName ? "#806040" : null,
  price,
  stock,
});

// Salvator: 2 kleuren × 3 maten.
const salvator = [
  v("pecan-200", "200 cm", "Pecan", 1149),
  v("pecan-230", "230 cm", "Pecan", 1299),
  v("pecan-300", "300 cm", "Pecan", 1599),
  v("walnut-200", "200 cm", "Walnut", 1249),
  v("walnut-230", "230 cm", "Walnut", 1399, 0),
  v("walnut-300", "300 cm", "Walnut", 1699),
];

describe("buildVariantOptions", () => {
  it("toont elke maat één keer, gesorteerd, en blijft in dezelfde kleur", () => {
    const { sizes } = buildVariantOptions(salvator, "walnut-200");
    expect(sizes.map((s) => s.label)).toEqual(["200 cm", "230 cm", "300 cm"]);
    expect(sizes.map((s) => s.slug)).toEqual(["walnut-200", "walnut-230", "walnut-300"]);
    expect(sizes.map((s) => s.price)).toEqual([1249, 1399, 1699]);
    expect(sizes.find((s) => s.current)?.label).toBe("200 cm");
  });

  it("toont alleen de kleuren van de huidige maat", () => {
    const { colors } = buildVariantOptions(salvator, "walnut-300");
    expect(colors.map((c) => c.slug)).toEqual(["pecan-300", "walnut-300"]);
    expect(colors.find((c) => c.current)?.colorName).toBe("Walnut");
  });

  it("valt terug op een andere kleur als de huidige kleur niet in die maat bestaat", () => {
    const model = [v("a-180", "180 cm", "Beige", 999), v("a-220", "220 cm", "Grijs", 1199), v("b-220", "220 cm", "Zwart", 1199, 0)];
    const { sizes } = buildVariantOptions(model, "a-180");
    expect(sizes.find((s) => s.label === "220 cm")?.slug).toBe("a-220");
  });

  it("markeert een maat als uitverkocht als geen enkele kleur in die maat voorraad heeft", () => {
    const model = [v("x-120", "Ø 120 cm", "Wit", 799), v("x-130", "Ø 130 cm", "Wit", 899, 0)];
    const { sizes } = buildVariantOptions(model, "x-120");
    expect(sizes.map((s) => [s.label, s.inStock])).toEqual([
      ["Ø 120 cm", true],
      ["Ø 130 cm", false],
    ]);
  });

  it("toont geen maatrij bij één maat en geen kleurrij bij één kleur", () => {
    const colorsOnly = [v("c1", null, "Beige", 199), v("c2", null, "Groen", 199)];
    expect(buildVariantOptions(colorsOnly, "c1").sizes).toEqual([]);
    expect(buildVariantOptions(colorsOnly, "c1").colors).toHaveLength(2);
    const sizesOnly = [v("s1", "180 cm", null, 999), v("s2", "220 cm", null, 1199)];
    expect(buildVariantOptions(sizesOnly, "s1").colors).toEqual([]);
    expect(buildVariantOptions(sizesOnly, "s1").sizes).toHaveLength(2);
  });

  it("geeft niets terug als het huidige product niet in de groep zit", () => {
    expect(buildVariantOptions(salvator, "onbekend")).toEqual({ sizes: [], colors: [] });
  });
});

describe("maten en kleuren", () => {
  it("sorteert maten op het eerste getal", () => {
    expect(["300 cm", "Ø 130 cm", "200 cm", "180-220 cm"].sort(compareSizes)).toEqual([
      "Ø 130 cm",
      "180-220 cm",
      "200 cm",
      "300 cm",
    ]);
  });

  it("ontdubbelt maten en kleuren hoofdletterongevoelig", () => {
    expect(distinctSizes([{ sizeName: "200 cm" }, { sizeName: "200 CM" }, { sizeName: null }])).toEqual(["200 cm"]);
    expect(distinctColors(salvator).map((c) => c.colorName)).toEqual(["Pecan", "Walnut"]);
  });

  it("maakt een korte maatlijst", () => {
    expect(formatSizeList(["180 cm", "200 cm", "220 cm"])).toBe("180, 200 en 220 cm");
    expect(formatSizeList(["Ø 120 cm", "Ø 130 cm"])).toBe("Ø 120 en Ø 130 cm");
    expect(formatSizeList(["160 × 90", "180 × 100"])).toBe("160 × 90 en 180 × 100");
  });
});

describe("swatchBackground", () => {
  it("geeft één kleur of een diagonaal gedeelde stof/onderstel-kleur", () => {
    expect(swatchBackground("#D8C7A8")).toEqual({ background: "#D8C7A8" });
    expect(swatchBackground("#F5F5F0/#1C1C1C")).toEqual({
      background: "linear-gradient(135deg, #F5F5F0 0 50%, #1C1C1C 50% 100%)",
    });
  });

  it("laat geen ongeldige CSS uit de database door", () => {
    expect(swatchBackground(null)).toBeUndefined();
    expect(swatchBackground("red")).toBeUndefined();
    expect(swatchBackground("#123456;background:url(x)")).toBeUndefined();
    expect(swatchBackground("#123456/url(x)")).toEqual({ background: "#123456" });
  });
});

describe("listing-helpers", () => {
  it("houdt één product per model en laat losse producten staan", () => {
    const list = [
      { id: 1, colorGroup: "a" },
      { id: 2, colorGroup: null },
      { id: 3, colorGroup: "a" },
      { id: 4, colorGroup: "b" },
    ];
    expect(onePerModel(list).map((p) => p.id)).toEqual([1, 2, 4]);
  });

  it("telt ongegroepeerde naamgenoten als één model", () => {
    const list = [
      { id: 1, colorGroup: null, name: "Salontafel 'Apollo' 130 cm" },
      { id: 2, colorGroup: null, name: "salontafel 'apollo' 130 cm " },
      { id: 3, colorGroup: null, name: "Salontafel 'Apollo' 90 cm" },
    ];
    expect(onePerModel(list).map((p) => p.id)).toEqual([1, 3]);
  });

  it("zet uitverkocht achteraan zonder de volgorde verder te wijzigen", () => {
    const list = [
      { id: 1, stock: 0 },
      { id: 2, stock: 3 },
      { id: 3 },
      { id: 4, stock: 0 },
    ];
    expect(inStockFirst(list).map((p) => p.id)).toEqual([2, 3, 1, 4]);
  });
});

describe("primaryVariantSlugs", () => {
  it("kiest per model en maat de oudste variant; losse producten en andere maten blijven", () => {
    const rows = [
      { slug: "tafel-wit-200", colorGroup: "tafel", sizeName: "200 cm", createdAt: "2026-02-01" },
      { slug: "tafel-zwart-200", colorGroup: "tafel", sizeName: "200 cm", createdAt: "2026-01-01" },
      { slug: "tafel-zwart-180", colorGroup: "tafel", sizeName: "180 cm", createdAt: "2026-03-01" },
      { slug: "los-product", colorGroup: null, sizeName: null, createdAt: "2026-01-01" },
    ];
    expect([...primaryVariantSlugs(rows)].sort()).toEqual(["los-product", "tafel-zwart-180", "tafel-zwart-200"]);
  });
});
