import { parsePrice, parseRequiredPrice } from "@/lib/parse-price";

describe("lib/parse-price", () => {
  describe("parsePrice", () => {
    it.each([
      ["599", 599],
      ["599,50", 599.5],
      ["599.50", 599.5],
      ["599,5", 599.5],
      ["€ 1.299,00", 1299],
      ["€1299", 1299],
      ["1.299", 1299],
      ["1,299.50", 1299.5],
      ["1.299,50", 1299.5],
      ["  42  ", 42],
      ["0", 0],
    ])("leest %p als %p", (raw, expected) => {
      expect(parsePrice(raw)).toEqual({ value: expected });
    });

    it("geeft null bij leeg, null of undefined", () => {
      expect(parsePrice("")).toEqual({ value: null });
      expect(parsePrice("   ")).toEqual({ value: null });
      expect(parsePrice(null)).toEqual({ value: null });
      expect(parsePrice(undefined)).toEqual({ value: null });
    });

    it.each(["abc", "-5", "12,345,67", "1.2.3", "599,123", "€"])("weigert %p met een foutmelding", (raw) => {
      const result = parsePrice(raw);
      expect(result.value).toBeNull();
      expect(result.error).toMatch(/Ongeldige prijs/);
      expect(result.error).toContain(raw);
    });
  });

  describe("parseRequiredPrice", () => {
    it("accepteert een geldige prijs", () => {
      expect(parseRequiredPrice("10")).toEqual({ value: 10 });
    });

    it("maakt van leeg een verplicht-fout", () => {
      expect(parseRequiredPrice("")).toEqual({ value: null, error: "Prijs is verplicht" });
      expect(parseRequiredPrice(null)).toEqual({ value: null, error: "Prijs is verplicht" });
    });

    it("geeft de parse-fout door bij onleesbare invoer", () => {
      expect(parseRequiredPrice("abc").error).toMatch(/Ongeldige prijs/);
    });
  });
});
