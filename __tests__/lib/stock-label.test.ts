import { isOnOrder, stockLabel } from "@/components/ui/StockBadge";

describe("stockLabel", () => {
  it("toont 'Op bestelling' bij een levertijd in weken", () => {
    expect(isOnOrder("4 tot 8 weken")).toBe(true);
    expect(isOnOrder("Binnen 5 werkdagen")).toBe(false);
    expect(stockLabel(10, false, "4 tot 8 weken")).toBe("Op bestelling");
    expect(stockLabel(2, true, "2 tot 4 weken")).toBe("Op bestelling");
  });

  it("houdt op voorraad, laag en uitverkocht zoals voorheen", () => {
    expect(stockLabel(10, false, "Binnen 5 werkdagen")).toBe("Op voorraad");
    expect(stockLabel(2, true)).toBe("Nog 2 op voorraad");
    expect(stockLabel(0, true, "4 tot 8 weken")).toBe("Uitverkocht");
    expect(stockLabel(undefined)).toBe("Op voorraad");
  });
});
