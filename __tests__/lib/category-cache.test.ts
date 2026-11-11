import { cacheableCategory } from "@/lib/category-cache";

const sp = (q = "") => new URLSearchParams(q);

describe("cacheableCategory", () => {
  it("herkent een kale categorie-URL", () => {
    expect(cacheableCategory("/eettafels", sp())).toBe("eettafels");
    expect(cacheableCategory("/banken/", sp())).toBe("banken");
    expect(cacheableCategory("/eettafels", sp("_rsc=abc"))).toBe("eettafels");
  });

  it("laat gefilterde, gesorteerde en gepagineerde URL's dynamisch", () => {
    expect(cacheableCategory("/eettafels", sp("vorm=rond"))).toBeNull();
    expect(cacheableCategory("/eettafels", sp("page=2"))).toBeNull();
    expect(cacheableCategory("/eettafels", sp("sorteer=naam&_rsc=x"))).toBeNull();
  });

  it("negeert productpagina's en onbekende paden", () => {
    expect(cacheableCategory("/eettafels/tafel-x", sp())).toBeNull();
    expect(cacheableCategory("/bestaat-niet", sp())).toBeNull();
    expect(cacheableCategory("/", sp())).toBeNull();
    expect(cacheableCategory("/checkout", sp())).toBeNull();
  });
});
