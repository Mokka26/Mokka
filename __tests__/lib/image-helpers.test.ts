import { parseImages, imageUrls, firstImageUrl, firstImageOnly, imageAspect, frameMode } from "@/lib/imageHelpers";

const A = "https://res.cloudinary.com/mokka/image/upload/v1/a.jpg";
const B = "https://res.cloudinary.com/mokka/image/upload/v1/b.jpg";

describe("lib/imageHelpers", () => {
  describe("parseImages", () => {
    it("leest strings en objecten (url/src, w/h als getal of string, alt)", () => {
      const raw = JSON.stringify([
        A,
        { url: B, w: 1600, h: 1200, alt: " zijaanzicht " },
        { src: "  https://x/c.jpg ", width: "800", height: "600" },
      ]);
      expect(parseImages(raw)).toEqual([
        { url: A },
        { url: B, w: 1600, h: 1200, alt: "zijaanzicht" },
        { url: "https://x/c.jpg", w: 800, h: 600 },
      ]);
    });

    it("leest bg (plain/scene) en negeert onbekende waarden", () => {
      const raw = JSON.stringify([{ url: A, bg: "scene" }, { url: B, bg: "plain" }, { url: A, bg: "paars" }]);
      expect(parseImages(raw)).toEqual([{ url: A, bg: "scene" }, { url: B, bg: "plain" }, { url: A }]);
      // firstImageOnly serialiseert via parseImages: bg mag daarbij niet verloren gaan.
      expect(JSON.parse(firstImageOnly(raw))).toEqual([{ url: A, bg: "scene" }]);
    });

    it("laat lege, ongeldige of niet-positieve waarden weg", () => {
      const raw = JSON.stringify(["", "   ", null, 42, { url: "" }, { url: A, w: 0, h: -5, alt: "  " }, { w: 10 }]);
      expect(parseImages(raw)).toEqual([{ url: A }]);
    });

    it("geeft [] bij null, lege string, kapotte JSON of een niet-array", () => {
      expect(parseImages(null)).toEqual([]);
      expect(parseImages(undefined)).toEqual([]);
      expect(parseImages("")).toEqual([]);
      expect(parseImages("[niet json")).toEqual([]);
      expect(parseImages('{"url":"x"}')).toEqual([]);
    });
  });

  it("imageUrls / firstImageUrl / firstImageOnly", () => {
    const raw = JSON.stringify([{ url: A, w: 4, h: 3 }, B]);
    expect(imageUrls(raw)).toEqual([A, B]);
    expect(firstImageUrl(raw)).toBe(A);
    expect(firstImageUrl("[]")).toBeNull();
    expect(firstImageOnly(raw)).toBe(JSON.stringify([{ url: A, w: 4, h: 3 }]));
    expect(firstImageOnly("[]")).toBe("[]");
  });

  it("frameMode: sfeerfoto bijsnijden, vrijstaand of onbekend opvullen", () => {
    expect(frameMode({ bg: "scene" })).toBe("fill");
    expect(frameMode({ bg: "plain" })).toBe("contain");
    expect(frameMode({})).toBe("contain");
    expect(frameMode(undefined)).toBe("contain");
  });

  it("imageAspect geeft w/h of de fallback", () => {
    expect(imageAspect({ url: A, w: 1600, h: 1200 })).toBe(4 / 3);
    expect(imageAspect({ url: A })).toBe(1);
    expect(imageAspect(undefined, 0.75)).toBe(0.75);
  });
});
