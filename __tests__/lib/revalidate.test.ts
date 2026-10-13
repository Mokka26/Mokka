import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { CATEGORIES } from "@/lib/categories";
import { revalidateProduct, revalidateAllProducts, PRODUCTS_TAG } from "@/lib/revalidate";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn(), updateTag: jest.fn() }));

function revalidatedPaths(): string[] {
  return jest.mocked(revalidatePath).mock.calls.map((call) => call[0]);
}

describe("lib/revalidate", () => {
  describe("revalidateProduct", () => {
    it("ververst PDP, categorie, umbrella, homepage, overzicht, sitemap, feed en legacy-route", () => {
      revalidateProduct({ slug: "hoekbank-milano", category: "hoekbanken" });
      const paths = revalidatedPaths();
      expect(paths).toEqual(
        expect.arrayContaining([
          "/hoekbanken/hoekbank-milano",
          "/banken/hoekbank-milano",
          "/hoekbanken",
          "/banken",
          "/",
          "/products",
          "/sitemap.xml",
          "/feed/google-shopping.xml",
          "/products/hoekbank-milano",
          "/admin/products/hoekbank-milano",
        ]),
      );
      // Server Action (default): updateTag = direct vervallen, read-your-own-writes.
      expect(updateTag).toHaveBeenCalledWith(PRODUCTS_TAG);
      expect(revalidateTag).not.toHaveBeenCalled();
      expect(PRODUCTS_TAG).toBe("products");
    });

    it("laat de tag in background-modus (webhook/cron) direct vervallen, niet stale-while-revalidate", () => {
      revalidateProduct({ slug: "x", category: "bedden" }, undefined, { mode: "background" });
      expect(revalidateTag).toHaveBeenCalledWith(PRODUCTS_TAG, { expire: 0 });
      expect(revalidateTag).not.toHaveBeenCalledWith(PRODUCTS_TAG, "max");
      expect(updateTag).not.toHaveBeenCalled();
      expect(revalidatedPaths()).toContain("/bedden/x");
    });

    it("ververst elk pad precies één keer", () => {
      revalidateProduct({ slug: "x", category: "hoekbanken" });
      const paths = revalidatedPaths();
      expect(new Set(paths).size).toBe(paths.length);
    });

    it("neemt de vorige slug mee bij een slug-wijziging", () => {
      revalidateProduct({ slug: "nieuw", category: "eettafels" }, { slug: "oud" });
      const paths = revalidatedPaths();
      expect(paths).toEqual(expect.arrayContaining(["/eettafels/nieuw", "/eettafels/oud", "/products/oud", "/tafels/oud"]));
    });

    it("neemt de vorige categorie mee bij een categorie-wijziging", () => {
      revalidateProduct({ slug: "x", category: "salontafels" }, { category: "bijzettafels" });
      const paths = revalidatedPaths();
      expect(paths).toEqual(expect.arrayContaining(["/salontafels/x", "/bijzettafels/x", "/bijzettafels", "/tafels/x"]));
    });

    it("ververst bij een onbekende categorie alleen de globale en legacy-paden", () => {
      revalidateProduct({ slug: "x", category: "onbekend" });
      const paths = revalidatedPaths();
      expect(paths).toEqual(expect.arrayContaining(["/", "/products/x"]));
      expect(paths).not.toContain("/onbekend/x");
    });
  });

  describe("revalidateAllProducts", () => {
    it("ververst alle categorie-pagina's, de dynamische PDP-route en de tag", () => {
      revalidateAllProducts();
      const paths = revalidatedPaths();
      for (const c of CATEGORIES) expect(paths).toContain(`/${c.slug}`);
      expect(revalidatePath).toHaveBeenCalledWith("/[category]/[slug]", "page");
      expect(paths).toEqual(expect.arrayContaining(["/", "/sitemap.xml", "/feed/google-shopping.xml"]));
      expect(updateTag).toHaveBeenCalledWith(PRODUCTS_TAG);
    });

    it("gebruikt in background-modus revalidateTag met expire 0", () => {
      revalidateAllProducts({ mode: "background" });
      expect(revalidateTag).toHaveBeenCalledWith(PRODUCTS_TAG, { expire: 0 });
      expect(updateTag).not.toHaveBeenCalled();
    });
  });
});
