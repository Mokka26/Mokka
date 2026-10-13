import { makeProduct } from "@/__tests__/helpers/fixtures";
import { buildFeedDocument, stripHtml, xmlEscape } from "@/lib/google-shopping";

// Tekens die XML 1.0 niet toestaat (zie INVALID_XML_CHARS in lib/google-shopping.ts).
const INVALID_XML = /[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/u;

describe("lib/google-shopping · XML-validiteit", () => {
  describe("xmlEscape", () => {
    it("escapet de vijf XML-tekens", () => {
      expect(xmlEscape(`Tom & Jerry <b>"x"</b> 'y'`)).toBe("Tom &amp; Jerry &lt;b&gt;&quot;x&quot;&lt;/b&gt; &apos;y&apos;");
    });

    it("verwijdert ongeldige control-tekens maar houdt tab, newline, CR en Unicode", () => {
      expect(xmlEscape("A\u0000B\u0007C\u001FD￾E￿F")).toBe("ABCDEF");
      expect(xmlEscape("regel 1\nregel 2\tkolom\r")).toBe("regel 1\nregel 2\tkolom\r");
      expect(xmlEscape("Crème brûlée — 120 × 60 cm 😀")).toBe("Crème brûlée — 120 × 60 cm 😀");
      // Losse surrogaat (geen geldig tekenpaar) is ongeldig in XML.
      expect(xmlEscape("a\uD800b")).toBe("ab");
    });
  });

  describe("stripHtml", () => {
    it("haalt tags en entiteiten weg en voegt witruimte samen", () => {
      expect(stripHtml("<p>Eén&nbsp;regel</p><p>Twee &amp; drie<br/>vier</p>")).toBe("Eén regel\nTwee & drie\nvier");
    });

    it("decodeert &amp; als laatste zodat dubbel-gecodeerde markup tekst blijft", () => {
      // "&amp;lt;b&amp;gt;" is de tekst "&lt;b&gt;" — géén <b>-tag.
      expect(stripHtml("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
      expect(stripHtml("A &amp;amp; B")).toBe("A &amp; B");
    });
  });

  describe("buildFeedDocument", () => {
    it("levert een document zonder ongeldige XML-tekens, ook als naam en beschrijving ze bevatten", () => {
      const vies = makeProduct({
        name: "Bed\u0000 Oslo\u0007 <Luxe>",
        description: "Een bed\u001F met & en <b>opmaak</b>\u0008.",
        specs: JSON.stringify({ Materiaal: "Eiken\u0001hout", Afmetingen: "160 × 200 cm" }),
        colorName: "Zwart\u0002",
      });
      const { xml, itemCount } = buildFeedDocument([vies]);
      expect(itemCount).toBe(1);
      expect(INVALID_XML.test(xml)).toBe(false);
      expect(xml).toContain("&lt;Luxe&gt;");
      expect(xml).not.toContain("<Luxe>");
      expect(xml).toContain("<g:material>Eikenhout</g:material>");
      expect(xml).toContain("<g:color>Zwart</g:color>");
      // Beschrijving: tags eruit, ampersand correct ge-escaped.
      expect(xml).toMatch(/<g:description>Een bed met &amp; en opmaak ?\.<\/g:description>/);
      // Wel-gevormd: elke geopende tag wordt gesloten (ruwe telling per tagnaam).
      for (const name of ["item", "g:id", "title", "g:description", "g:price"]) {
        const open = xml.match(new RegExp(`<${name}>`, "g"))?.length ?? 0;
        const close = xml.match(new RegExp(`</${name}>`, "g"))?.length ?? 0;
        expect(close).toBe(open);
      }
    });
  });
});
