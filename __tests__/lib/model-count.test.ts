import { countModels } from "@/lib/model-count";

describe("countModels", () => {
  it("telt producten zonder colorGroup elk als één model", () => {
    expect(countModels([{ colorGroup: null, count: 3 }])).toBe(3);
  });

  it("telt alle varianten met dezelfde colorGroup als één model", () => {
    expect(
      countModels([
        { colorGroup: "apollo", count: 4 },
        { colorGroup: "apollo", count: 2 },
        { colorGroup: "nora", count: 1 },
        { colorGroup: null, count: 2 },
      ]),
    ).toBe(4);
  });

  it("negeert lege rijen", () => {
    expect(countModels([{ colorGroup: "x", count: 0 }, { colorGroup: null, count: 0 }])).toBe(0);
    expect(countModels([])).toBe(0);
  });
});
