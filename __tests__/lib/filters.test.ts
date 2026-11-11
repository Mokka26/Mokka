import {
  activeChips,
  colorFamilies,
  emptyFilters,
  filterModels,
  filtersToQuery,
  materialGroups,
  parseFilters,
  parsePrice,
  priceLabel,
  sortModels,
  variantTraits,
  type FilterableVariant,
} from "@/lib/filters";

type TestVariant = FilterableVariant & { id: string };

const p = (over: Partial<FilterableVariant> & { id: string }): TestVariant => ({
  name: "Eettafel",
  category: "eettafels",
  price: 999,
  stock: 3,
  colorName: null,
  sizeName: null,
  specs: null,
  ...over,
});

const specs = (o: Record<string, string>) => JSON.stringify(o);

describe("materialGroups", () => {
  it("schoont leveranciersnamen op tot vaste groepen", () => {
    expect(materialGroups("Mangohout, Gecoat staal")).toEqual(["mangohout"]);
    expect(materialGroups("Mango hout")).toEqual(["mangohout"]);
    expect(materialGroups("Keramiek / sintersteen")).toEqual(["keramiek-sintersteen"]);
    expect(materialGroups("sintersteen")).toEqual(["keramiek-sintersteen"]);
    expect(materialGroups("Faux Marmer")).toEqual(["steen-look"]);
    expect(materialGroups("Decor")).toEqual(["steen-look"]);
    expect(materialGroups("Hout (fineer)")).toEqual(["hout"]);
    expect(materialGroups("Bouclé-stof")).toEqual(["boucle"]);
    expect(materialGroups("PU")).toEqual(["leer"]);
  });

  it("telt metaal alleen als hoofdmateriaal", () => {
    expect(materialGroups("Staal")).toEqual(["metaal"]);
    expect(materialGroups("Eiken, staal")).toEqual(["hout"]);
  });
});

describe("colorFamilies", () => {
  it("brengt kleurnamen terug tot families", () => {
    expect(colorFamilies("Donkergrijs")).toEqual(["grijs"]);
    expect(colorFamilies("Zwart, Bruin")).toEqual(["zwart", "bruin"]);
    expect(colorFamilies("Flintstone")).toEqual(["grijs"]);
    expect(colorFamilies("Crème")).toEqual(["creme"]);
    expect(colorFamilies("Onbekend")).toEqual([]);
  });
});

describe("variantTraits", () => {
  it("leidt maat en vorm van een eettafel af uit de afmetingen", () => {
    const rect = variantTraits(p({ id: "a", specs: specs({ Afmetingen: "B 180 × D 90 × H 76 cm" }) }));
    expect(rect.values.maat).toEqual(["160-200"]);
    expect(rect.values.vorm).toEqual(["rechthoek"]);
    const round = variantTraits(p({ id: "b", specs: specs({ Afmetingen: "Ø 130 cm" }) }));
    expect(round.values.maat).toEqual(["tot-160"]);
    expect(round.values.vorm).toEqual(["rond"]);
    const oval = variantTraits(
      p({ id: "c", name: "Eettafel Deens ovaal", specs: specs({ Afmetingen: "B 240 × D 100 cm" }) }),
    );
    expect(oval.values.vorm).toEqual(["ovaal"]);
    expect(oval.values.maat).toEqual(["240-plus"]);
  });

  it("geeft stoelen geen maat of vorm, wel kleur uit colorName", () => {
    const t = variantTraits(
      p({ id: "s", category: "eetkamerstoelen", colorName: "Taupe", specs: specs({ Kleur: "Beige" }) }),
    );
    expect(t.values.maat).toEqual([]);
    expect(t.values.vorm).toEqual([]);
    expect(t.values.kleur).toEqual(["taupe"]);
  });
});

describe("URL-staat", () => {
  it("leest en schrijft filters stabiel", () => {
    const f = parseFilters({ kleur: "zwart,wit", vorm: "rond", prijs: "500-1000", voorraad: "1", sorteer: "naam", page: "2" });
    expect(f.multi.kleur).toEqual(["zwart", "wit"]);
    expect(f.prijs).toEqual({ min: 500, max: 1000 });
    expect(filtersToQuery(f)).toBe("vorm=rond&kleur=wit,zwart&prijs=500-1000&voorraad=1&sorteer=naam");
  });

  it("negeert ongeldige waarden", () => {
    const f = parseFilters({ kleur: "<script>,zwart", sorteer: "hack", prijs: "abc" });
    expect(f.multi.kleur).toEqual(["zwart"]);
    expect(f.sort).toBe("aanbevolen");
    expect(f.prijs).toBeNull();
    expect(filtersToQuery(emptyFilters())).toBe("");
  });

  it("begrijpt open prijsgrenzen", () => {
    expect(parsePrice("2000-")).toEqual({ min: 2000 });
    expect(parsePrice("0-300")).toEqual({ min: 0, max: 300 });
    expect(parsePrice("900-400")).toEqual({ min: 400, max: 900 });
    expect(priceLabel({ min: 2000 })).toBe("€ 2.000 en meer");
    expect(priceLabel({ min: 0, max: 300 })).toBe("Tot € 300");
  });
});

describe("filterModels", () => {
  // Model A: zelfde tafel in zwart (uitverkocht) en wit; model B: ronde bruine tafel.
  const a1 = p({ id: "a1", colorName: "Zwart", stock: 0, price: 900, specs: specs({ Afmetingen: "B 200 × D 100 cm" }) });
  const a2 = p({ id: "a2", colorName: "Wit", price: 950, specs: specs({ Afmetingen: "B 200 × D 100 cm" }) });
  const b1 = p({ id: "b1", colorName: "Bruin", price: 1500, specs: specs({ Afmetingen: "Ø 130 cm" }) });
  const models: TestVariant[][] = [[a1, a2], [b1]];

  it("kiest per model de variant die past (op voorraad eerst)", () => {
    const none = filterModels(models, variantTraits, emptyFilters());
    expect(none.models.map((v) => v.id)).toEqual(["a2", "b1"]);
    const zwart = filterModels(models, variantTraits, parseFilters({ kleur: "zwart" }));
    expect(zwart.models.map((v) => v.id)).toEqual(["a1"]);
  });

  it("telt per waarde zonder het eigen filter mee te nemen", () => {
    const res = filterModels(models, variantTraits, parseFilters({ kleur: "zwart" }));
    const kleur = res.facets.find((f) => f.key === "kleur");
    expect(kleur?.options.map((o) => [o.value, o.count, o.selected])).toEqual(
      expect.arrayContaining([
        ["zwart", 1, true],
        ["wit", 1, false],
        ["bruin", 1, false],
      ]),
    );
    // Met "zwart" actief is er alleen nog een rechthoekige tafel → vormfilter heeft 1 optie en verdwijnt.
    expect(res.facets.find((f) => f.key === "vorm")).toBeUndefined();
  });

  it("combineert filters: binnen één filter OF, tussen filters EN", () => {
    const res = filterModels(models, variantTraits, parseFilters({ kleur: "wit,bruin", vorm: "rond" }));
    expect(res.models.map((v) => v.id)).toEqual(["b1"]);
  });

  it("telt prijsklassen en voorraad", () => {
    const res = filterModels(models, variantTraits, emptyFilters());
    expect(res.priceOptions.find((o) => o.value === "500-1000")?.count).toBe(1);
    expect(res.priceOptions.find((o) => o.value === "1000-2000")?.count).toBe(1);
    expect(res.inStockCount).toBe(2);
    const voorraad = filterModels(models, variantTraits, parseFilters({ voorraad: "1", kleur: "zwart" }));
    expect(voorraad.models).toEqual([]);
  });

  it("maakt chips die precies één filter weghalen", () => {
    const f = parseFilters({ kleur: "zwart,wit", prijs: "500-1000" });
    const res = filterModels(models, variantTraits, f);
    const chips = activeChips(f, res.facets);
    expect(chips.map((c) => c.label)).toEqual(["Zwart", "Wit", "€ 500 tot € 1.000"]);
    expect(filtersToQuery(chips[0].without)).toBe("kleur=wit&prijs=500-1000");
  });
});

describe("sortModels", () => {
  it("sorteert op prijs en naam zonder de invoer te wijzigen", () => {
    const list = [
      { name: "Bora", price: 300 },
      { name: "Alto", price: 900 },
    ];
    expect(sortModels(list, "prijs-aflopend").map((x) => x.name)).toEqual(["Alto", "Bora"]);
    expect(sortModels(list, "naam").map((x) => x.name)).toEqual(["Alto", "Bora"]);
    expect(list[0].name).toBe("Bora");
  });
});
