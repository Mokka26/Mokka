import { makeProduct, sizeVariantsJson, IMAGE_URL } from "@/__tests__/helpers/fixtures";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import {
  buildItems,
  buildFeedDocument,
  buildTitle,
  isFeedEligible,
  parseHandlingDays,
  priceBucket,
  deliveryLabel,
  xmlEscape,
  stripHtml,
  type FeedProduct,
} from "@/lib/google-shopping";

/** Waarde van één <g:naam>…</g:naam>-tag, of null als de tag ontbreekt. */
function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1] : null;
}

function tags(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}>([^<]*)</${name}>`, "g"))].map((m) => m[1]);
}

const table: FeedProduct = makeProduct({
  id: "tafel_1",
  slug: "rousseau-200",
  name: "Rousseau ZB-5635",
  category: "eettafels",
  price: 1299,
  colorName: "Zwart",
  specs: JSON.stringify({ Materiaal: "Eikenhout", Afmetingen: "B 200 × D 100 × H 76 cm", Artikelnummer: "ZB-5635" }),
  deliveryTime: "2-3 werkdagen",
  featured: true,
  source: "Rousseau",
});

describe("lib/google-shopping", () => {
  describe("isFeedEligible / buildItems-filter", () => {
    it("neemt alleen zichtbare, niet-verwijderde producten met voorraad en prijs > 0 op", () => {
      expect(isFeedEligible(table)).toBe(true);
      expect(isFeedEligible(makeProduct({ price: 0 }))).toBe(false);
      expect(isFeedEligible(makeProduct({ price: -1 }))).toBe(false);
      expect(isFeedEligible(makeProduct({ hidden: true }))).toBe(false);
      expect(isFeedEligible(makeProduct({ deletedAt: new Date() }))).toBe(false);
      expect(isFeedEligible(makeProduct({ stock: 0 }))).toBe(false);
      expect(buildItems(makeProduct({ price: 0 }))).toEqual([]);
    });

    it("laat een product met prijs 0 maar geprijsde maatvarianten wel toe", () => {
      const p = makeProduct({ price: 0, sizeVariants: sizeVariantsJson([{ label: "140 × 200", price: 599 }]) });
      expect(isFeedEligible(p)).toBe(true);
      expect(buildItems(p)).toHaveLength(1);
    });

    it("telt een product zonder afbeelding niet mee in het feed-document", () => {
      const { itemCount, xml } = buildFeedDocument([makeProduct({ images: "[]" })]);
      expect(itemCount).toBe(0);
      expect(xml).not.toContain("<item>");
    });
  });

  describe("één product → één item", () => {
    const [item] = buildItems(table);

    it("bouwt de titel als type + naam zonder code – materiaal – kleur – afmeting", () => {
      expect(tag(item, "g:title")).toBe("Eettafel Rousseau – Eikenhout – Zwart – B 200 × D 100 × H 76 cm");
    });

    it("gebruikt het stabiele id, de canonieke link en de eerste afbeelding", () => {
      expect(tag(item, "g:id")).toBe("tafel_1");
      expect(tag(item, "g:link")).toBe(`${businessInfo.siteUrl}/eettafels/rousseau-200`);
      expect(tag(item, "g:image_link")).toBe(IMAGE_URL);
      expect(tag(item, "g:availability")).toBe("in_stock");
      expect(tag(item, "g:condition")).toBe("new");
    });

    it("zet prijs, categorie, producttype, kleur, materiaal en afmetingen", () => {
      expect(tag(item, "g:price")).toBe("1299.00 EUR");
      expect(tag(item, "g:sale_price")).toBeNull();
      expect(tag(item, "g:google_product_category")).toBe("4355");
      expect(tag(item, "g:product_type")).toBe("Meubels &gt; Tafels &gt; Eettafels");
      expect(tag(item, "g:color")).toBe("Zwart");
      expect(tag(item, "g:material")).toBe("Eikenhout");
      expect(tag(item, "g:product_width")).toBe("200 cm");
      expect(tag(item, "g:product_length")).toBe("100 cm");
      expect(tag(item, "g:product_height")).toBe("76 cm");
    });

    it("zet custom_label_0 op favoriet/regulier en lekt de bron (source) niet", () => {
      expect(tag(item, "g:custom_label_0")).toBe("favoriet");
      expect(tag(buildItems(makeProduct({ ...table, featured: false }))[0], "g:custom_label_0")).toBe("regulier");
      expect(item).not.toContain("Rousseau ZB"); // originele naam met code
      expect(item).not.toMatch(/source/i);
      expect(tag(item, "g:custom_label_1")).toBe("1000-2000");
      expect(tag(item, "g:custom_label_2")).toBe("eettafels");
      expect(tag(item, "g:custom_label_3")).toBe("snel-leverbaar");
    });

    it("zet handling-tijd uit de levertijd", () => {
      expect(tag(item, "g:min_handling_time")).toBe("2");
      expect(tag(item, "g:max_handling_time")).toBe("3");
      expect(tag(item, "g:transit_time_label")).toBe("snel-leverbaar");
    });

    it("geeft gratis verzending boven de drempel en het standaardtarief eronder, per land", () => {
      const countries = tags(item, "g:country");
      expect(countries).toEqual([...shippingInfo.freeShippingCountries]);
      const shippingBlocks = item.match(/<g:shipping>.*?<\/g:shipping>/g) ?? [];
      expect(shippingBlocks).toHaveLength(shippingInfo.freeShippingCountries.length);
      for (const block of shippingBlocks) expect(tag(block, "g:price")).toBe("0.00 EUR");

      const cheap = buildItems(makeProduct({ ...table, price: 49.95 }))[0];
      const cheapBlocks = cheap.match(/<g:shipping>.*?<\/g:shipping>/g) ?? [];
      for (const block of cheapBlocks) expect(tag(block, "g:price")).toBe(`${shippingInfo.rates.standard.toFixed(2)} EUR`);
    });

    it("markeert producten jonger dan 30 dagen als nieuw", () => {
      const fresh = buildItems(makeProduct({ ...table, createdAt: new Date() }))[0];
      expect(tag(fresh, "g:custom_label_4")).toBe("nieuw");
      expect(tag(item, "g:custom_label_4")).toBeNull();
    });
  });

  describe("identificatie (brand / gtin / mpn)", () => {
    it("zet gtin + mpn zonder eigen merk bij een EAN-13", () => {
      const p = makeProduct({ ...table, specs: JSON.stringify({ EAN: "8712345678906", Artikelnummer: "ZB-5635" }) });
      const item = buildItems(p)[0];
      expect(tag(item, "g:gtin")).toBe("8712345678906");
      expect(tag(item, "g:mpn")).toBe("ZB-5635");
      expect(tag(item, "g:brand")).toBeNull();
      expect(tag(item, "g:identifier_exists")).toBeNull();
    });

    it("zet winkelnaam als brand en identifier_exists=no zonder (geldige) EAN", () => {
      for (const ean of [undefined, "123", "12345678901234567", "abc"]) {
        const p = makeProduct({ ...table, specs: JSON.stringify(ean ? { EAN: ean } : {}) });
        const item = buildItems(p)[0];
        expect(tag(item, "g:gtin")).toBeNull();
        expect(tag(item, "g:brand")).toBe(businessInfo.name);
        expect(tag(item, "g:identifier_exists")).toBe("no");
        expect(tag(item, "g:mpn")).toBeNull();
      }
    });

    it("zet merk + gtin + mpn als specs.Merk bekend is", () => {
      const p = makeProduct({ ...table, specs: JSON.stringify({ Merk: "Rousseau", EAN: "8712 3456 78906", Artikelnummer: "ZB-5635" }) });
      const item = buildItems(p)[0];
      expect(tag(item, "g:brand")).toBe("Rousseau");
      expect(tag(item, "g:gtin")).toBe("8712345678906");
      expect(tag(item, "g:mpn")).toBe("ZB-5635");
      expect(tag(item, "g:identifier_exists")).toBeNull();
    });
  });

  describe("maatvarianten", () => {
    const bed = makeProduct({
      id: "bed_1",
      slug: "bed-oslo",
      name: "Bed Oslo",
      category: "bedden",
      price: 599,
      sizeVariants: sizeVariantsJson([
        { label: "140 × 200", price: 599 },
        { label: "160 × 200", price: 699, listPrice: 899 },
      ]),
    });
    const items = buildItems(bed);

    it("maakt één item per variant met item_group_id, size en een link met ?maat=", () => {
      expect(items).toHaveLength(2);
      expect(tag(items[0], "g:id")).toBe("bed_1-1");
      expect(tag(items[1], "g:id")).toBe("bed_1-2");
      expect(tags(items[0], "g:item_group_id")).toEqual(["bed_1"]);
      expect(tag(items[0], "g:size")).toBe("140 × 200");
      expect(tag(items[0], "g:link")).toBe(`${businessInfo.siteUrl}/bedden/bed-oslo?maat=${encodeURIComponent("140 × 200")}`);
    });

    it("gebruikt de variantprijs en de maat als afmeting in de titel", () => {
      expect(tag(items[1], "g:price")).toBe("699.00 EUR");
      expect(tag(items[1], "g:title")).toBe("Bed Oslo – 160 × 200 cm");
      expect(tag(items[1], "g:product_width")).toBe("160 cm");
      expect(tag(items[1], "g:product_length")).toBe("200 cm");
      // Omnibus: adviesprijs niet als doorgestreepte referentie (USE_LIST_PRICE_AS_REFERENCE = false)
      expect(tag(items[1], "g:sale_price")).toBeNull();
    });
  });

  describe("buildTitle", () => {
    it("herhaalt geen woorden die al in de naam zitten en kapt op 150 tekens", () => {
      const p = makeProduct({ ...table, name: "Eettafel Rousseau zwart eikenhout" });
      expect(buildTitle(p, { Materiaal: "Eikenhout" }, "B 200 × D 100 × H 76 cm")).toBe(
        "Eettafel Rousseau zwart eikenhout – B 200 × D 100 × H 76 cm",
      );
      const long = makeProduct({ ...table, name: "Eettafel " + "Rousseau ".repeat(30) });
      const title = buildTitle(long, {}, null);
      expect(title.length).toBeLessThanOrEqual(150);
      expect(title.endsWith("Rousseau")).toBe(true);
    });
  });

  describe("kleine helpers", () => {
    it("parseHandlingDays", () => {
      expect(parseHandlingDays("2-3 werkdagen")).toEqual({ min: 2, max: 3 });
      expect(parseHandlingDays("Binnen 5 werkdagen")).toEqual({ min: 0, max: 5 });
      expect(parseHandlingDays("4 tot 8 weken")).toEqual({ min: 20, max: 40 });
      expect(parseHandlingDays("Op aanvraag")).toBeNull();
      expect(parseHandlingDays(null)).toBeNull();
    });

    it("priceBucket / deliveryLabel", () => {
      expect(priceBucket(249.99)).toBe("0-250");
      expect(priceBucket(250)).toBe("250-500");
      expect(priceBucket(999)).toBe("500-1000");
      expect(priceBucket(1999)).toBe("1000-2000");
      expect(priceBucket(2000)).toBe("2000+");
      expect(deliveryLabel({ min: 1, max: 5 })).toBe("snel-leverbaar");
      expect(deliveryLabel({ min: 1, max: 6 })).toBe("langere-levertijd");
      expect(deliveryLabel(null)).toBe("langere-levertijd");
    });

    it("xmlEscape / stripHtml", () => {
      expect(xmlEscape(`Tom & Jerry <b>"x"</b> 'y'`)).toBe("Tom &amp; Jerry &lt;b&gt;&quot;x&quot;&lt;/b&gt; &apos;y&apos;");
      expect(stripHtml("<p>Eén&nbsp;regel</p><p>Twee &amp; drie<br/>vier</p>")).toBe("Eén regel\nTwee & drie\nvier");
    });
  });
});
