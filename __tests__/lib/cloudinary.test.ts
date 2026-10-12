import { cldUrl, cloudinaryLoader, cldOptimize } from "@/lib/cloudinary-url";
import { extractPublicId } from "@/lib/cloudinary-helpers";

const BASE = "https://res.cloudinary.com/mokka/image/upload";
const SRC = `${BASE}/v1700000000/mokka/banken/anna-bank/foto-1.jpg`;

describe("lib/cloudinary-url", () => {
  const ORIGINAL_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "mokka";
  });
  afterAll(() => {
    if (ORIGINAL_CLOUD === undefined) delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    else process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = ORIGINAL_CLOUD;
  });

  describe("cldUrl", () => {
    it("bouwt een URL met transformaties in vaste volgorde", () => {
      expect(cldUrl("products/banken/armoni/1", { width: 800 })).toBe(`${BASE}/w_800,q_auto,f_auto/products/banken/armoni/1`);
      expect(cldUrl("x", { width: 800, height: 600, crop: "fill", quality: 80, format: "webp" })).toBe(
        `${BASE}/w_800,h_600,c_fill,q_80,f_webp/x`,
      );
      expect(cldUrl("x")).toBe(`${BASE}/q_auto,f_auto/x`);
    });
  });

  describe("cloudinaryLoader", () => {
    it("laat niet-Cloudinary-bronnen ongemoeid", () => {
      expect(cloudinaryLoader({ src: "https://images.unsplash.com/a.jpg", width: 640 })).toBe("https://images.unsplash.com/a.jpg");
    });

    it("vervangt de bestaande w_<n> door de gevraagde srcSet-breedte", () => {
      const src = `${BASE}/c_pad,b_white,ar_4:3,w_1000,f_auto,q_auto/v1/foto.jpg`;
      expect(cloudinaryLoader({ src, width: 640 })).toBe(`${BASE}/c_pad,b_white,ar_4:3,w_640,f_auto,q_auto/v1/foto.jpg`);
    });

    it("voegt w_<n> toe als die ontbreekt", () => {
      expect(cloudinaryLoader({ src: SRC, width: 828 })).toBe(`${BASE}/w_828/v1700000000/mokka/banken/anna-bank/foto-1.jpg`);
    });

    it("stript e_upscale (alleen geldig voor de basisbreedte)", () => {
      const src = `${BASE}/e_upscale,c_pad,b_white,w_1000,f_auto,q_auto/v1/foto.jpg`;
      const out = cloudinaryLoader({ src, width: 1440 });
      expect(out).not.toContain("e_upscale");
      expect(out).toContain("w_1440");
      const mid = `${BASE}/c_pad,e_upscale,w_1000/v1/foto.jpg`;
      expect(cloudinaryLoader({ src: mid, width: 640 })).toBe(`${BASE}/c_pad,w_640/v1/foto.jpg`);
    });
  });

  describe("cldOptimize", () => {
    it("laat lege of niet-Cloudinary-URL's ongemoeid", () => {
      expect(cldOptimize("")).toBe("");
      expect(cldOptimize("https://images.unsplash.com/a.jpg", { w: 800 })).toBe("https://images.unsplash.com/a.jpg");
      expect(cldOptimize("https://res.cloudinary.com/mokka/raw/x.jpg")).toBe("https://res.cloudinary.com/mokka/raw/x.jpg");
    });

    it("gebruikt standaard f_auto,q_auto zonder opties", () => {
      expect(cldOptimize(SRC)).toBe(`${BASE}/f_auto,q_auto/v1700000000/mokka/banken/anna-bank/foto-1.jpg`);
    });

    it.each([
      ["pad", "c_pad,b_white,ar_4:3"],
      ["contain", "c_pad,b_auto,ar_4:3"],
      ["fill", "c_fill,g_auto,ar_4:3"],
      ["thumb", "c_thumb,g_auto,ar_4:3"],
    ] as const)("mode %s → %s", (mode, expected) => {
      expect(cldOptimize(SRC, { ar: "4:3", mode, w: 800 })).toBe(
        `${BASE}/${expected},w_800,f_auto,q_auto/v1700000000/mokka/banken/anna-bank/foto-1.jpg`,
      );
    });

    it("zet dpr en quality", () => {
      expect(cldOptimize(SRC, { w: 400, dpr: "auto", quality: "auto:good" })).toContain("/upload/w_400,dpr_auto,f_auto,q_auto:good/");
      expect(cldOptimize(SRC, { w: 400, dpr: 2, quality: 75 })).toContain("/upload/w_400,dpr_2,f_auto,q_75/");
    });

    it("past e_upscale alleen toe binnen de veilige grenzen (bron bekend, <1500px, factor 1.0-1.5)", () => {
      expect(cldOptimize(SRC, { upscale: true, w: 1200, sourceW: 1000 })).toContain("/upload/e_upscale,w_1200,");
      expect(cldOptimize(SRC, { upscale: true, w: 1200 })).not.toContain("e_upscale"); // bron onbekend
      expect(cldOptimize(SRC, { upscale: true, w: 1600, sourceW: 1000 })).not.toContain("e_upscale"); // factor 1.6
      expect(cldOptimize(SRC, { upscale: true, w: 1000, sourceW: 1200 })).not.toContain("e_upscale"); // downscale
      expect(cldOptimize(SRC, { upscale: true, w: 2000, sourceW: 1600 })).not.toContain("e_upscale"); // bron ≥ 1500
      expect(cldOptimize(SRC, { upscale: false, w: 1200, sourceW: 1000 })).not.toContain("e_upscale");
    });
  });
});

describe("lib/cloudinary-helpers · extractPublicId", () => {
  it("haalt het publicId zonder versie, transformaties en extensie uit een secure_url", () => {
    expect(extractPublicId(SRC)).toBe("mokka/banken/anna-bank/foto-1");
    expect(extractPublicId(`${BASE}/w_800,q_auto/v123/mokka/x/y.PNG`)).toBe("mokka/x/y");
    expect(extractPublicId(`${BASE}/mokka/x/y.webp`)).toBe("mokka/x/y");
    expect(extractPublicId(`${BASE}/v1/mokka/x/y`)).toBe("mokka/x/y");
  });

  it("geeft null voor niet-Cloudinary- of onvolledige URL's", () => {
    expect(extractPublicId("")).toBeNull();
    expect(extractPublicId("https://images.unsplash.com/a.jpg")).toBeNull();
    expect(extractPublicId("https://res.cloudinary.com/mokka/image/x.jpg")).toBeNull();
    expect(extractPublicId(`${BASE}/`)).toBeNull();
  });
});
