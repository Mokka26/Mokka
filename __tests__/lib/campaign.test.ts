import { BAMBI_GIFT_ENDS_AT, BAMBI_SLEEP_SET, giftFor, giftLineLabel, isGiftActive } from "@/lib/campaign";

const DURING = Date.parse("2026-11-20T12:00:00+01:00");
const LAST_MINUTE = Date.parse("2026-11-30T23:59:59+01:00");

describe("Bambi-slaapset (Black Friday 2026)", () => {
  it("geldt voor Bambi- en BSS Bambi-bedden tijdens de actie", () => {
    expect(giftFor({ source: "bambi", category: "bedden" }, DURING)).toBe(BAMBI_SLEEP_SET);
    expect(giftFor({ source: "  BSS  Bambi ", category: "bedden" }, DURING)).toBe(BAMBI_SLEEP_SET);
    expect(giftFor({ source: "bambi", category: "bedden" }, LAST_MINUTE)).toBe(BAMBI_SLEEP_SET);
  });

  it("niet voor andere leveranciers of categorieën", () => {
    expect(giftFor({ source: "BSS", category: "bedden" }, DURING)).toBeNull();
    expect(giftFor({ source: "One World", category: "bedden" }, DURING)).toBeNull();
    expect(giftFor({ source: null, category: "bedden" }, DURING)).toBeNull();
    expect(giftFor({ source: "bambi", category: "matrassen" }, DURING)).toBeNull();
  });

  it("stopt op 1 december 00:00 Nederlandse tijd", () => {
    expect(isGiftActive(BAMBI_GIFT_ENDS_AT - 1)).toBe(true);
    expect(isGiftActive(BAMBI_GIFT_ENDS_AT)).toBe(false);
    expect(giftFor({ source: "bambi", category: "bedden" }, BAMBI_GIFT_ENDS_AT)).toBeNull();
  });

  it("orderlabel", () => {
    expect(giftLineLabel(BAMBI_SLEEP_SET.name)).toBe("+ gratis Bambi Mogy Soft slaapset");
  });
});
