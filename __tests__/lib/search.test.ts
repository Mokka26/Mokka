import { buildSearchWhere, searchTerms } from "@/lib/search";

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
