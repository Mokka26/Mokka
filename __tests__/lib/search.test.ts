import { buildSearchWhere, matchesSearch, searchTerms } from "@/lib/search";

describe("searchTerms", () => {
  it("normaliseert en kort meervoud in", () => {
    expect(searchTerms("Hoekbanken")).toEqual(["hoekbank"]);
    expect(searchTerms("eettafel Eiken")).toEqual(["eettafel", "eik"]);
    expect(searchTerms("salon tafel")).toEqual(["salon", "tafel"]);
    expect(searchTerms("Crème bank!")).toEqual(["creme", "bank"]);
    expect(searchTerms("a")).toEqual([]);
    expect(searchTerms("ronde eettafel")).toEqual(["rond", "eettafel"]);
    expect(searchTerms("boucle")).toEqual(["boucle"]);
  });

  it("vindt namen met een Turkse i (i + punt)", () => {
    expect(searchTerms("Ni̇rvana")).toEqual(["nirvana"]);
  });
});

describe("buildSearchWhere", () => {
  it("eist elk woord en koppelt categoriewoorden aan de categorie", () => {
    const where = buildSearchWhere("hoekbanken grijs");
    expect(where?.AND).toHaveLength(2);
    const first = (where?.AND as Array<{ OR: Array<Record<string, unknown>> }>)[0].OR;
    expect(first).toEqual(expect.arrayContaining([{ category: { in: expect.arrayContaining(["hoekbanken"]) } }]));
  });

  it("geeft null bij een lege zoekterm", () => {
    expect(buildSearchWhere("  ")).toBeNull();
  });
});

describe("matchesSearch (in het geheugen)", () => {
  const tafel = { name: "Enzo eettafel rond Ø120", colorName: "Walnoot", specs: '{"Materiaal":"Keramiek"}', category: "eettafels" };
  const stoel = { name: "Stoel 'Sevilla'", colorName: "Zand", specs: '{"Materiaal":"Bouclé"}', category: "eetkamerstoelen" };

  it("eist elk woord in naam, kleur, specs of categorie", () => {
    expect(matchesSearch(tafel, searchTerms("ronde eettafel"))).toBe(true);
    expect(matchesSearch(tafel, searchTerms("eettafel walnoot"))).toBe(true);
    expect(matchesSearch(tafel, searchTerms("eettafel marmer"))).toBe(false);
  });

  it("negeert accenten en vindt via de categorie", () => {
    expect(matchesSearch(stoel, searchTerms("boucle"))).toBe(true);
    expect(matchesSearch(stoel, searchTerms("eetkamerstoelen zand"))).toBe(true);
  });

  it("laat alles door zonder zoekwoorden", () => {
    expect(matchesSearch(stoel, [])).toBe(true);
  });
});
