import { toCents, fromCents, round2, vatFromGrossCents, centsToMollieValue, formatCents } from "@/lib/money";

describe("lib/money", () => {
  describe("toCents", () => {
    it("zet euro's om naar hele centen", () => {
      expect(toCents(799)).toBe(79900);
      expect(toCents(12.34)).toBe(1234);
      expect(toCents(0)).toBe(0);
    });

    it("rondt float-ruis correct af (1.005 → 101, 0.1 + 0.2 → 30)", () => {
      expect(toCents(1.005)).toBe(101);
      expect(toCents(0.1 + 0.2)).toBe(30);
      expect(toCents(2.675)).toBe(268);
    });

    it("is de inverse van fromCents", () => {
      for (const cents of [1, 99, 100, 4995, 129900, 999999]) {
        expect(toCents(fromCents(cents))).toBe(cents);
      }
    });
  });

  describe("fromCents / round2", () => {
    it("geeft euro's met twee decimalen", () => {
      expect(fromCents(12345)).toBe(123.45);
      expect(fromCents(0)).toBe(0);
    });

    it("round2 rondt via centen af", () => {
      expect(round2(1.005)).toBe(1.01);
      expect(round2(2.675)).toBe(2.68);
      expect(round2(599)).toBe(599);
    });
  });

  describe("vatFromGrossCents", () => {
    it("haalt de btw uit een bruto bedrag", () => {
      expect(vatFromGrossCents(12100, 21)).toBe(2100);
      expect(vatFromGrossCents(59900, 21)).toBe(10396);
      expect(vatFromGrossCents(0, 21)).toBe(0);
    });

    it("rondt op hele centen", () => {
      // 100 × 21 / 121 = 17,35… → 17
      expect(vatFromGrossCents(100, 21)).toBe(17);
      // 495 × 21 / 121 = 85,9… → 86
      expect(vatFromGrossCents(495, 21)).toBe(86);
    });

    it("werkt met een ander tarief", () => {
      expect(vatFromGrossCents(10900, 9)).toBe(900);
    });
  });

  describe("centsToMollieValue", () => {
    it("geeft altijd exact twee decimalen", () => {
      expect(centsToMollieValue(79900)).toBe("799.00");
      expect(centsToMollieValue(5)).toBe("0.05");
      expect(centsToMollieValue(1050)).toBe("10.50");
      expect(centsToMollieValue(0)).toBe("0.00");
    });

    it("behoudt het minteken bij negatieve bedragen", () => {
      expect(centsToMollieValue(-150)).toBe("-1.50");
    });
  });

  describe("formatCents", () => {
    it("toont Nederlandse notatie met euroteken", () => {
      const nbspFree = formatCents(129900).replace(/ /g, " ");
      expect(nbspFree).toBe("€ 1.299,00");
      expect(formatCents(495).replace(/ /g, " ")).toBe("€ 4,95");
    });
  });
});
