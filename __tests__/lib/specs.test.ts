import {
  parseDimensions,
  formatDimensions,
  isCanonicalDimensions,
  plausibleDimensions,
  normalizeSpecKeys,
  parseSpecs,
  dimensionContext,
  deriveMaterial,
  stripProductCode,
  findProductCode,
  slugify,
  colorHexFor,
  productTypeLabel,
  nameHasType,
} from "@/lib/specs";

describe("lib/specs", () => {
  describe("parseDimensions", () => {
    it.each([
      ["B 120 × D 60 × H 45 cm", { w: 120, d: 60, h: 45 }],
      ["B120×D60×H45", { w: 120, d: 60, h: 45 }],
      ["b 120 x d 60 x h 45", { w: 120, d: 60, h: 45 }],
      ["120x60x45 cm", { w: 120, d: 60, h: 45 }],
      ["120 × 60 cm", { w: 120, d: 60 }],
      ["L 200 B 100 H 76", { w: 200, d: 100, h: 76 }],
      ["Breedte 120 cm, diepte 60 cm, hoogte 45 cm", { w: 120, d: 60, h: 45 }],
      ["Ø 120 cm", { diameter: 120 }],
      ["ø120", { diameter: 120 }],
      ["Ø 120 × H 75 cm", { diameter: 120, h: 75 }],
      ["180/220×90 cm", { w: 180, wMax: 220, d: 90 }],
      ["B 180/220 × D 90 × H 76 cm", { w: 180, wMax: 220, d: 90, h: 76 }],
      ["250/230/57 cm", { w: 250, d: 230, h: 57 }],
      ["80 × 140 × 3,7 cm", { w: 80, d: 140, h: 3.7 }],
      ["80 × 140 × 3.75 cm", { w: 80, d: 140, h: 3.8 }],
    ])("leest %p", (text, expected) => {
      expect(parseDimensions(text)).toEqual(expected);
    });

    it("leest kale getallen bij spiegels en wandlampen als B × H (× D)", () => {
      expect(parseDimensions("120 × 60 cm", "spiegels")).toEqual({ w: 120, h: 60 });
      expect(parseDimensions("60 × 80 × 3 cm", "wandlampen")).toEqual({ w: 60, h: 80, d: 3 });
      expect(parseDimensions("120 × 60 cm", "banken")).toEqual({ w: 120, d: 60 });
    });

    it.each([
      ["", null],
      [null, null],
      [undefined, null],
      ["120", null],
      ["120 cm", null],
      ["Matrasmaten: 140×200, 160×200", null],
      ["140×200, 160×200", null],
      ["3×30", null],
      ["B 1200 × D 60", null],
      ["Ø 0,5", null],
      ["10 × 20 × 30 × 40", null],
      ["Stoel met 4 poten van 45 cm", null],
    ])("geeft null bij onbruikbare invoer %p", (text, expected) => {
      expect(parseDimensions(text)).toBe(expected);
    });

    it("negeert een wMax die niet groter is dan w", () => {
      expect(parseDimensions("B 220/180 × D 90")).toEqual({ w: 220, d: 90 });
    });
  });

  describe("formatDimensions", () => {
    it.each([
      [{ w: 120, d: 60, h: 45 }, "B 120 × D 60 × H 45 cm"],
      [{ w: 180, wMax: 220, d: 90 }, "B 180/220 × D 90 cm"],
      [{ diameter: 120, h: 75 }, "Ø 120 × H 75 cm"],
      [{ diameter: 120 }, "Ø 120 cm"],
      [{ w: 80, d: 140, h: 3.7 }, "B 80 × D 140 × H 3,7 cm"],
      [{ h: 45 }, "H 45 cm"],
    ])("formatteert %p als %p", (dims, expected) => {
      expect(formatDimensions(dims)).toBe(expected);
    });

    it("geeft null zonder maten", () => {
      expect(formatDimensions(null)).toBeNull();
      expect(formatDimensions(undefined)).toBeNull();
      expect(formatDimensions({})).toBeNull();
    });

    it("is een vast punt: parse(format(x)) == x", () => {
      for (const text of ["B 120 × D 60 × H 45 cm", "B 180/220 × D 90 cm", "Ø 120 × H 75 cm", "B 80 × D 140 × H 3,7 cm"]) {
        expect(formatDimensions(parseDimensions(text))).toBe(text);
        expect(isCanonicalDimensions(text)).toBe(true);
      }
      expect(isCanonicalDimensions("120x60x45")).toBe(false);
    });
  });

  describe("plausibleDimensions", () => {
    it("wijst een bank van 265 cm hoog af en accepteert normale maten", () => {
      expect(plausibleDimensions("banken", { w: 265, d: 100, h: 265 })).toBe(false);
      expect(plausibleDimensions("banken", { w: 265, d: 100, h: 85 })).toBe(true);
      expect(plausibleDimensions("banken", null)).toBe(false);
      expect(plausibleDimensions("onbekend", { h: 999 })).toBe(true);
    });
  });

  describe("parseSpecs", () => {
    it("leest een JSON-object met strings en getallen", () => {
      expect(parseSpecs('{"Materiaal":" Eiken ","Garantie":2,"Leeg":"  ","":"x"}')).toEqual({
        Materiaal: "Eiken",
        Garantie: "2",
      });
    });

    it("geeft {} bij ongeldige of lege invoer", () => {
      expect(parseSpecs(null)).toEqual({});
      expect(parseSpecs("")).toEqual({});
      expect(parseSpecs("niet json")).toEqual({});
      expect(parseSpecs("[1,2]")).toEqual({});
    });
  });

  describe("normalizeSpecKeys", () => {
    it("verwijdert kolom-dubbelingen, herstelt aliassen en typefouten en ordent vast", () => {
      const out = normalizeSpecKeys({
        Categorie: "bedden",
        Levertijd: "2-3 werkdagen",
        levertijdken: "x",
        afmeting: "120 × 60",
        materialen: "Eiken",
        "Opsteling kiezen": "Links",
        EAN: "8712345678906",
        sku: "AB-1",
        Kleur: "Grijs",
        bladvorm: "rond",
        garantie: "2 jaar",
      });
      expect(Object.keys(out)).toEqual(["Afmetingen", "Materiaal", "Kleur", "Opstelling", "Garantie", "Bladvorm", "Artikelnummer", "EAN"]);
      expect(out).not.toHaveProperty("Categorie");
      expect(out).not.toHaveProperty("Levertijd");
      expect(out.Opstelling).toBe("Links");
      expect(out.Artikelnummer).toBe("AB-1");
    });

    it("laat de eerste waarde winnen bij dubbele sleutels en laat lege waarden weg", () => {
      expect(normalizeSpecKeys({ Materiaal: "Eiken", materialen: "Teak", Kleur: "   " })).toEqual({ Materiaal: "Eiken" });
    });

    it("zet Artikelnummer en EAN altijd achteraan", () => {
      const out = normalizeSpecKeys({ EAN: "1", Artikelnummer: "2", Zzz: "3", Serie: "4" });
      expect(Object.keys(out)).toEqual(["Serie", "Zzz", "Artikelnummer", "EAN"]);
    });
  });

  describe("dimensionContext", () => {
    it("vertaalt eettafelmaten naar personen", () => {
      expect(dimensionContext("eettafels", { w: 200 })).toBe("Plaats voor 6 tot 8 personen");
      expect(dimensionContext("eettafels", { w: 240 })).toBe("Plaats voor 8 tot 10 personen");
      expect(dimensionContext("eettafels", { w: 180, wMax: 220 })).toBe("Plaats voor 6 tot 8 personen, uitgeschoven 8 tot 10 personen");
      expect(dimensionContext("eettafels", { w: 160, wMax: 170 })).toBe("Plaats voor 4 tot 6 personen");
      expect(dimensionContext("eettafels", { diameter: 120 })).toBe("Ronde tafel met plaats voor 4 tot 6 personen");
      expect(dimensionContext("eettafels", { diameter: 80 })).toBeNull();
      expect(dimensionContext("eettafels", { w: 80 })).toBeNull();
      expect(dimensionContext("eettafels", { h: 76 })).toBeNull();
    });

    it("geeft zitbreedte plus kamerbreedte bij banken", () => {
      expect(dimensionContext("hoekbanken", { w: 280 })).toBe("Zitbreedte 280 cm — past in een woonkamer vanaf 4 m breed");
      expect(dimensionContext("banken", { w: 220 })).toBe("Zitbreedte 220 cm — past in een woonkamer vanaf 3,5 m breed");
      expect(dimensionContext("bankstellen", { h: 80 })).toBeNull();
    });

    it("geeft de matrasmaat bij bedden, alleen bij geloofwaardige maten", () => {
      expect(dimensionContext("bedden", { w: 160, d: 200 })).toBe("Matrasmaat 160 × 200 cm");
      expect(dimensionContext("matrassen", { w: 90, d: 200 })).toBe("Matrasmaat 90 × 200 cm");
      expect(dimensionContext("bedden", { w: 50, d: 200 })).toBeNull();
      expect(dimensionContext("bedden", { w: 160 })).toBeNull();
    });

    it("geeft null voor andere categorieën of zonder maten", () => {
      expect(dimensionContext("fauteuils", { w: 90 })).toBeNull();
      expect(dimensionContext("eettafels", null)).toBeNull();
    });
  });

  describe("deriveMaterial", () => {
    it("vindt precies één materiaal", () => {
      expect(deriveMaterial("Eettafel van massief eikenhout")).toBe("Eikenhout");
      expect(deriveMaterial("Oak dining table")).toBe("Eikenhout");
      expect(deriveMaterial("Bank in boucle stof")).toBeNull(); // boucle én stof
      expect(deriveMaterial("Marmer en eiken")).toBeNull();
      expect(deriveMaterial("Hoekbank Milano")).toBeNull();
      expect(deriveMaterial(null)).toBeNull();
    });

    // Regressietest (bug gevonden en gefixt op 2026-10-12): `\b` in JS-regex kent
    // alleen ASCII-woordtekens, dus `\b(bouclé|boucle)\b` matcht nooit op de
    // Nederlandse spelling "bouclé" (na de é is er geen woordgrens). Alleen
    // "boucle" zonder accent wordt herkend. Verwijder `.failing` na de fix
    // (bv. de `u`-vlag met \p{L}-grenzen, of accent-vouwen vóór het matchen).
    it("herkent de spelling bouclé met accent", () => {
      expect(deriveMaterial("Fauteuil in bouclé")).toBe("Bouclé");
    });
  });

  describe("findProductCode / stripProductCode", () => {
    it.each([
      ["Hoekbank ZB-5635 Grijs", "ZB-5635", "Hoekbank Grijs"],
      ["Bed QL10648", "QL10648", "Bed"],
      ["Tafel GH1018 eiken", "GH1018", "Tafel eiken"],
      ["ART1017 Lamp", "ART1017", "Lamp"],
      ["Stoel MT-97", "MT-97", "Stoel"],
      ["Kast 056", "056", "Kast"],
      ["Bed 15564D2-E", "15564D2-E", "Bed"],
      ["Lamp 1-25131YD2-E", "1-25131YD2-E", "Lamp"],
    ])("%p → code %p, naam %p", (name, code, stripped) => {
      expect(findProductCode(name)).toBe(code);
      expect(stripProductCode(name)).toBe(stripped);
    });

    it("laat namen zonder code ongemoeid", () => {
      expect(findProductCode("Hoekbank Milano")).toBeNull();
      expect(stripProductCode("Hoekbank Milano")).toBe("Hoekbank Milano");
      expect(stripProductCode("Eettafel 200 cm")).toBe("Eettafel 200 cm");
    });

    // Regressietest (bug gevonden en gefixt op 2026-10-12): bij een code tussen
    // haakjes wordt de openingshaak door de regex meegeconsumeerd, waardoor
    // de sluithaak blijft staan: "Tafel (GH1018)" → "Tafel )". Deze test
    // slaagt zolang de bug bestaat en gaat falen zodra hij gefixt is —
    // verwijder dan `.failing`.
    it("ruimt haakjes rond een code op", () => {
      expect(stripProductCode("Tafel (GH1018)")).toBe("Tafel");
    });
  });

  describe("slugify", () => {
    it("maakt een lowercase slug zonder diakrieten", () => {
      expect(slugify("Eettafel Élan 200 × 100")).toBe("eettafel-elan-200-100");
      expect(slugify("  --Hoekbank  Milano--  ")).toBe("hoekbank-milano");
      expect(slugify("Crème & Café")).toBe("creme-cafe");
    });
  });

  describe("colorHexFor", () => {
    it("vindt kleuren exact, zonder diakrieten en op één bekend woord", () => {
      expect(colorHexFor("Zwart")).toBe("#1C1C1C");
      expect(colorHexFor("creme")).toBe("#EFE7D6");
      expect(colorHexFor("Grijze eik")).toBe("#B89B6E");
      expect(colorHexFor("Zwart / Wit")).toBeNull();
      expect(colorHexFor("Paars")).toBeNull();
      expect(colorHexFor(null)).toBeNull();
    });
  });

  describe("productTypeLabel / nameHasType", () => {
    it("kent het producttype en herkent synoniemen in namen", () => {
      expect(productTypeLabel("eetkamerstoelen")).toBe("Eetkamerstoel");
      expect(productTypeLabel("onbekend")).toBeNull();
      expect(nameHasType("eettafels", "Rousseau tafel 200")).toBe(true);
      expect(nameHasType("eettafels", "Rousseau")).toBe(false);
      expect(nameHasType("bedden", "Boxspring Oslo")).toBe(true);
      expect(nameHasType("onbekend", "Bed")).toBe(false);
    });
  });
});
