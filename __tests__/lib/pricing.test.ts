import { makeProduct, sizeVariantsJson } from "@/__tests__/helpers/fixtures";
import { clampOptions, nachtkastAddon, priceLine, readSizeVariants, voetbankAddon, zitbankAddon } from "@/lib/pricing";

const bed = makeProduct({
  id: "bed",
  price: 599,
  sizeVariants: sizeVariantsJson([
    { label: "140 × 200", price: 599 },
    { label: "160 × 200", price: 699 },
  ]),
  nachtkastMode: "optional",
  nachtkastPrice: 89,
  nachtkastPrice2: 159,
  voetbankMode: "optional",
  voetbankPrice: 129,
});

const bankstel = makeProduct({
  id: "bankstel",
  slug: "bankstel-milano",
  name: "Bankstel Milano 3+2",
  category: "bankstellen",
  price: 1899,
  zitbankMode: "optional",
  zitbankPrice: 250,
});

describe("lib/pricing", () => {
  describe("priceLine — maten (CODE-6, CODE-9)", () => {
    it("weigert een product met maten zonder maatlabel (VARIANT_MISSING)", () => {
      expect(priceLine(bed, {})).toEqual({ ok: false, reason: "VARIANT_MISSING" });
      expect(priceLine(bed, { variantLabel: null })).toEqual({ ok: false, reason: "VARIANT_MISSING" });
    });

    it("vergelijkt maatlabels getrimd, aan beide kanten (zoals de PDP)", () => {
      const p = makeProduct({ price: 599, sizeVariants: JSON.stringify([{ label: " 160 × 200 ", price: 699 }]) });
      expect(priceLine(p, { variantLabel: "160 × 200" })).toMatchObject({ ok: true, unitCents: 69900, variantLabel: "160 × 200" });
      expect(priceLine(p, { variantLabel: "  160 × 200\n" })).toMatchObject({ ok: true, unitCents: 69900 });
    });

    it("valt bij een maat zonder eigen prijs terug op de productprijs", () => {
      const p = makeProduct({ price: 499, sizeVariants: JSON.stringify([{ label: "90 × 200" }]) });
      expect(priceLine(p, { variantLabel: "90 × 200" })).toMatchObject({ ok: true, unitCents: 49900 });
    });

    it("markeert kapotte maatdata als corrupt", () => {
      expect(priceLine(makeProduct({ sizeVariants: "{kapot" }), { variantLabel: "x" })).toEqual({ ok: false, reason: "VARIANT_MISSING", corrupt: true });
      expect(readSizeVariants("{\"a\":1}")).toBeNull();
      expect(readSizeVariants("")).toEqual([]);
    });
  });

  describe("priceLine — opties (CODE-7)", () => {
    it("weigert een nachtkast zonder positieve toeslag (nooit gratis meeleveren)", () => {
      const zero = makeProduct({ ...bed, nachtkastPrice: 0, nachtkastPrice2: null });
      expect(priceLine(zero, { variantLabel: "140 × 200", nachtkast: 1 })).toEqual({ ok: false, reason: "NO_PRICE" });
      expect(priceLine(zero, { variantLabel: "140 × 200", nachtkast: 2 })).toEqual({ ok: false, reason: "NO_PRICE" });
      const nullPrice = makeProduct({ ...bed, nachtkastPrice: null, nachtkastPrice2: null });
      expect(priceLine(nullPrice, { variantLabel: "140 × 200", nachtkast: 1 })).toEqual({ ok: false, reason: "NO_PRICE" });
      // Zonder nachtkast gewoon te koop.
      expect(priceLine(zero, { variantLabel: "140 × 200" })).toMatchObject({ ok: true, unitCents: 59900 });
    });

    it("weigert een voetbank zonder positieve toeslag", () => {
      const zero = makeProduct({ ...bed, voetbankPrice: 0 });
      expect(priceLine(zero, { variantLabel: "140 × 200", voetbank: 1 })).toEqual({ ok: false, reason: "NO_PRICE" });
      expect(priceLine(zero, { variantLabel: "140 × 200", voetbank: 0 })).toMatchObject({ ok: true });
    });

    it("telt maat + nachtkasten + voetbank in centen op", () => {
      expect(priceLine(bed, { variantLabel: "160 × 200", nachtkast: 2, voetbank: 1 })).toEqual({
        ok: true,
        unitCents: 69900 + 15900 + 12900,
        variantLabel: "160 × 200",
        fullLabel: "160 × 200 · 2 nachtkasten · voetbank",
      });
    });
  });

  describe("helpers voor de PDP", () => {
    it("nachtkastAddon/voetbankAddon geven alleen bij modus optional een toeslag", () => {
      expect(nachtkastAddon(bed, 1)).toBe(89);
      expect(nachtkastAddon(bed, 2)).toBe(159);
      expect(nachtkastAddon({ ...bed, nachtkastPrice2: null }, 2)).toBe(178);
      expect(nachtkastAddon({ ...bed, nachtkastMode: "included" }, 1)).toBe(0);
      expect(voetbankAddon(bed, 1)).toBe(129);
      expect(voetbankAddon({ voetbankMode: undefined, voetbankPrice: 129 }, 1)).toBe(0);
    });

    it("clampOptions begrenst nachtkasten op 0-2 en voetbank op 0-1", () => {
      expect(clampOptions(bed, { nachtkast: 7, voetbank: 3 })).toEqual({ nk: 2, vb: 1, zb: 0 });
      expect(clampOptions({ nachtkastMode: null, voetbankMode: "included" }, { nachtkast: 1, voetbank: 1 })).toEqual({ nk: 0, vb: 0, zb: 0 });
    });

    it("zitbankAddon geeft alleen bij modus optional een toeslag", () => {
      expect(zitbankAddon(bankstel, 1)).toBe(250);
      expect(zitbankAddon(bankstel, 0)).toBe(0);
      expect(zitbankAddon({ zitbankMode: null, zitbankPrice: 250 }, 1)).toBe(0);
      expect(zitbankAddon({ zitbankMode: "none", zitbankPrice: 250 }, 1)).toBe(0);
    });

    it("clampOptions begrenst de 1-zitsbank op 0-1, en 0 als hij niet los te bestellen is", () => {
      expect(clampOptions(bankstel, { zitbank: 5 })).toEqual({ nk: 0, vb: 0, zb: 1 });
      expect(clampOptions(bankstel, { zitbank: -2 })).toEqual({ nk: 0, vb: 0, zb: 0 });
      expect(clampOptions(bankstel, { zitbank: 0.9 })).toEqual({ nk: 0, vb: 0, zb: 0 });
      expect(clampOptions({ zitbankMode: null }, { zitbank: 1 })).toEqual({ nk: 0, vb: 0, zb: 0 });
    });
  });

  describe("priceLine — extra 1-zitsbank (bankstellen)", () => {
    it("telt de toeslag op en zet '1-zitsbank' in het label", () => {
      expect(priceLine(bankstel, { zitbank: 1 })).toEqual({
        ok: true,
        unitCents: 189900 + 25000,
        variantLabel: null,
        fullLabel: "1-zitsbank",
      });
      expect(priceLine(bankstel, { zitbank: 0 })).toEqual({ ok: true, unitCents: 189900, variantLabel: null, fullLabel: null });
    });

    it("rekent nooit meer dan één 1-zitsbank per regel", () => {
      expect(priceLine(bankstel, { zitbank: 3 })).toMatchObject({ ok: true, unitCents: 189900 + 25000 });
    });

    it("negeert een gevraagde 1-zitsbank als de optie uit staat", () => {
      const off = makeProduct({ ...bankstel, zitbankMode: null });
      expect(priceLine(off, { zitbank: 1 })).toEqual({ ok: true, unitCents: 189900, variantLabel: null, fullLabel: null });
    });

    it("weigert een gekozen 1-zitsbank zonder positieve toeslag (NO_PRICE)", () => {
      const zero = makeProduct({ ...bankstel, zitbankPrice: 0 });
      expect(priceLine(zero, { zitbank: 1 })).toEqual({ ok: false, reason: "NO_PRICE" });
      const nullPrice = makeProduct({ ...bankstel, zitbankPrice: null });
      expect(priceLine(nullPrice, { zitbank: 1 })).toEqual({ ok: false, reason: "NO_PRICE" });
      expect(priceLine(zero, { zitbank: 0 })).toMatchObject({ ok: true, unitCents: 189900 });
    });

    it("zet de 1-zitsbank achter maat en andere opties in het label", () => {
      const p = makeProduct({ ...bed, zitbankMode: "optional", zitbankPrice: 250 });
      expect(priceLine(p, { variantLabel: "140 × 200", voetbank: 1, zitbank: 1 })).toEqual({
        ok: true,
        unitCents: 59900 + 12900 + 25000,
        variantLabel: "140 × 200",
        fullLabel: "140 × 200 · voetbank · 1-zitsbank",
      });
    });
  });
});
