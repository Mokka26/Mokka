import { makeProduct, sizeVariantsJson, IMAGE_URL } from "@/__tests__/helpers/fixtures";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import {
  jsonLdHtml,
  collapseWhitespace,
  truncateAtWord,
  buildProductTitle,
  buildDescription,
  buildProductDescription,
  parseTransitDays,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  buildFaqJsonLd,
} from "@/lib/jsonLd";

type Offer = Record<string, unknown> & { shippingDetails: { shippingRate: { value: number } } };

function offersOf(schema: Record<string, unknown>): Offer {
  return schema.offers as Offer;
}

describe("lib/jsonLd", () => {
  describe("jsonLdHtml", () => {
    it("escapet < zodat </script> niet uit het blok kan breken", () => {
      const html = jsonLdHtml({ name: "</script><script>alert(1)</script>" });
      expect(html).not.toContain("</script>");
      expect(html).toContain("\\u003c/script>");
      expect(JSON.parse(html)).toEqual({ name: "</script><script>alert(1)</script>" });
    });
  });

  describe("tekst-helpers", () => {
    it("collapseWhitespace", () => {
      expect(collapseWhitespace("  Een \n\n bed  \t hier ")).toBe("Een bed hier");
    });

    it("truncateAtWord kapt op een woordgrens zonder los leesteken", () => {
      expect(truncateAtWord("Een rustig bed van eikenhout", 14)).toBe("Een rustig bed");
      expect(truncateAtWord("Een rustig bed, van eikenhout", 15)).toBe("Een rustig bed");
      expect(truncateAtWord("kort", 10)).toBe("kort");
      expect(truncateAtWord("x".repeat(30), 10)).toBe("x".repeat(10));
    });
  });

  describe("buildProductTitle", () => {
    const brand = businessInfo.name;

    it("gebruikt naam | categorie | merk als dat past", () => {
      expect(buildProductTitle("Bed Oslo", "Bedden")).toBe(`Bed Oslo | Bedden | ${brand}`);
      expect(buildProductTitle("Bed Oslo", null)).toBe(`Bed Oslo | ${brand}`);
    });

    it("laat eerst de categorie vallen en kort daarna de naam op een woordgrens in", () => {
      const name = "Hoekbank Milano met chaise longue links";
      expect(buildProductTitle(name, "Hoekbanken")).toBe(`${name} | ${brand}`);

      const long = "Hoekbank Milano met chaise longue links in antraciet bouclé stof";
      const title = buildProductTitle(long, "Hoekbanken");
      expect(title.length).toBeLessThanOrEqual(60);
      expect(title.endsWith(` | ${brand}`)).toBe(true);
      const namePart = title.slice(0, -` | ${brand}`.length);
      expect(long.startsWith(namePart)).toBe(true);
      expect(long.charAt(namePart.length)).toBe(" ");
    });
  });

  describe("buildDescription / buildProductDescription", () => {
    const fallback =
      "Bed Oslo bestel je bij Mokka Home, alle prijzen incl. btw en 14 dagen bedenktijd. Bekijk meer bedden in onze showroom in Den Haag of online.";

    it("vult een korte bron aan tot 140-160 tekens", () => {
      const out = buildDescription("Een rustig bed van eikenhout", fallback);
      expect(out.length).toBeGreaterThanOrEqual(140);
      expect(out.length).toBeLessThanOrEqual(160);
      expect(out.startsWith("Een rustig bed van eikenhout. Bed Oslo bestel je")).toBe(true);
    });

    it("gebruikt alleen de fallback bij een lege bron", () => {
      const out = buildDescription("", fallback);
      expect(out.startsWith("Bed Oslo bestel je")).toBe(true);
      expect(out.length).toBeLessThanOrEqual(160);
    });

    it("kapt een lange bron op een woordgrens af op maximaal 160 tekens", () => {
      const source = "Een rustig bed van massief eikenhout met een laag hoofdbord, ".repeat(6);
      const out = buildDescription(source, fallback);
      expect(out.length).toBeLessThanOrEqual(160);
      expect(out.length).toBeGreaterThanOrEqual(140);
      expect(collapseWhitespace(source).startsWith(out)).toBe(true);
      expect(out).not.toMatch(/[,\s]$/);
    });

    it("buildProductDescription bouwt een feitelijke fallback uit bedrijfsgegevens", () => {
      const out = buildProductDescription("", "Bed Oslo", "Bedden");
      expect(out).toContain(`bij ${businessInfo.name}`);
      expect(out).toContain(`${shippingInfo.returnWindowDays} dagen bedenktijd`);
      expect(out.length).toBeLessThanOrEqual(160);
    });
  });

  describe("parseTransitDays", () => {
    it.each([
      ["2-3 dagen", { min: 2, max: 3 }],
      ["2–4 weken", { min: 10, max: 20 }],
      ["4 tot 8 weken", { min: 20, max: 40 }],
      ["5 tot 3 dagen", { min: 3, max: 5 }],
      ["Op aanvraag", null],
      ["Binnen 5 werkdagen", null],
      [null, null],
    ])("%p → %p", (text, expected) => {
      expect(parseTransitDays(text)).toEqual(expected);
    });

    // Regressietest (bug gevonden en gefixt op 2026-10-12): de week-check
    // `/^we/i.test(m[3])` matcht ook "werkdag", waardoor "2-3 werkdagen"
    // (de standaard-levertijd uit lib/shipping-info.ts) als 10-15 dagen in
    // het Product-schema belandt (×5). Fix: `/^we(e)?k/i`. Verwijder daarna
    // `.failing` hier én in de Offer-test hieronder.
    it("leest werkdagen niet als weken", () => {
      expect(parseTransitDays("2-3 werkdagen")).toEqual({ min: 2, max: 3 });
    });
  });

  describe("buildProductJsonLd", () => {
    const url = `${businessInfo.siteUrl}/bedden/bed-oslo`;

    it("laat offers weg bij prijs ≤ 0 en gebruikt de winkelnaam als merk", () => {
      const schema = buildProductJsonLd(makeProduct({ price: 0 }), { url });
      expect(schema).toMatchObject({
        "@type": "Product",
        name: "Bed Oslo",
        sku: "bed-oslo",
        url,
        image: [IMAGE_URL],
        brand: { "@type": "Brand", name: businessInfo.name },
      });
      expect(schema).not.toHaveProperty("offers");
      expect(schema).not.toHaveProperty("gtin13");
    });

    it("bouwt een Offer met prijs, voorraad, retourbeleid en gratis verzending boven de drempel", () => {
      const schema = buildProductJsonLd(makeProduct({ price: 599, stock: 3 }), { url });
      const offers = offersOf(schema);
      expect(offers).toMatchObject({
        "@type": "Offer",
        price: "599.00",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: businessInfo.legalName },
        hasMerchantReturnPolicy: { merchantReturnDays: shippingInfo.returnWindowDays },
      });
      expect(offers.shippingDetails.shippingRate.value).toBe(0);
      expect(offers.shippingDetails).toMatchObject({
        deliveryTime: { handlingTime: { minValue: 1, maxValue: 3 }, transitTime: expect.any(Object) },
      });
    });

    // Zie de parseTransitDays-bug hierboven: "2-3 werkdagen" wordt 10-15 dagen.
    it("zet de transit-tijd van 2-3 werkdagen correct in het schema", () => {
      const schema = buildProductJsonLd(makeProduct({ price: 599, stock: 3, deliveryTime: "2-3 werkdagen" }), { url });
      expect(offersOf(schema).shippingDetails).toMatchObject({
        deliveryTime: { transitTime: { minValue: 2, maxValue: 3 } },
      });
    });

    it("rekent het standaardtarief onder de drempel en OutOfStock zonder voorraad", () => {
      const schema = buildProductJsonLd(makeProduct({ price: 49.95, stock: 0, deliveryTime: null }), { url });
      const offers = offersOf(schema);
      expect(offers.availability).toBe("https://schema.org/OutOfStock");
      expect(offers.shippingDetails.shippingRate.value).toBe(shippingInfo.rates.standard);
      expect(offers.shippingDetails).not.toHaveProperty("deliveryTime.transitTime");
    });

    it("bouwt een AggregateOffer bij maatvarianten", () => {
      const schema = buildProductJsonLd(
        makeProduct({
          price: 599,
          sizeVariants: sizeVariantsJson([
            { label: "140 × 200", price: 599 },
            { label: "160 × 200", price: 699 },
            { label: "180 × 200", price: 799 },
          ]),
        }),
        { url },
      );
      expect(offersOf(schema)).toMatchObject({ "@type": "AggregateOffer", lowPrice: "599.00", highPrice: "799.00", offerCount: 3 });
    });

    it("neemt alleen een echte EAN-13 op als gtin13 en laat het merk dan weg", () => {
      const withEan = buildProductJsonLd(makeProduct({ specs: JSON.stringify({ EAN: "8712 3456 78906", Artikelnummer: "QL1" }) }), { url });
      expect(withEan).toMatchObject({ gtin13: "8712345678906", sku: "QL1" });
      expect(withEan).not.toHaveProperty("brand");

      const shortEan = buildProductJsonLd(makeProduct({ specs: JSON.stringify({ EAN: "12345678" }) }), { url });
      expect(shortEan).not.toHaveProperty("gtin13");
      expect(shortEan).toHaveProperty("brand");

      const withBrand = buildProductJsonLd(makeProduct({ specs: JSON.stringify({ Merk: "Rousseau", EAN: "8712345678906" }) }), { url });
      expect(withBrand).toMatchObject({ gtin13: "8712345678906", brand: { name: "Rousseau" } });
    });
  });

  describe("overige schema's", () => {
    it("buildBreadcrumbJsonLd maakt relatieve URL's absoluut", () => {
      const schema = buildBreadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: "Bedden", url: "/bedden" },
        { name: "Extern", url: "https://example.org/x" },
      ]);
      expect(schema.itemListElement).toEqual([
        { "@type": "ListItem", position: 1, name: "Home", item: `${businessInfo.siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Bedden", item: `${businessInfo.siteUrl}/bedden` },
        { "@type": "ListItem", position: 3, name: "Extern", item: "https://example.org/x" },
      ]);
    });

    it("buildOrganizationJsonLd gebruikt uitsluitend lib/business-info", () => {
      const schema = buildOrganizationJsonLd();
      expect(schema).toMatchObject({
        "@type": ["LocalBusiness", "FurnitureStore"],
        "@id": `${businessInfo.siteUrl}/#organization`,
        name: businessInfo.legalName,
        alternateName: businessInfo.name,
        address: { streetAddress: businessInfo.address.street, postalCode: businessInfo.address.postalCode },
      });
      if (businessInfo.btw) expect(schema.vatID).toBe(businessInfo.btw);
      else expect(schema).not.toHaveProperty("vatID");
      if (businessInfo.kvk) expect(schema.taxID).toBe(businessInfo.kvk);
      if (businessInfo.contact.phone) expect(schema.telephone).toBe(businessInfo.contact.phone);
      expect(Array.isArray(schema.openingHoursSpecification)).toBe(true);
      expect(schema.openingHoursSpecification).toEqual(
        expect.arrayContaining([{ "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "11:00", closes: "17:00" }]),
      );
      expect(schema.openingHoursSpecification).not.toEqual(expect.arrayContaining([expect.objectContaining({ dayOfWeek: "Sunday" })]));
    });

    it("buildWebSiteJsonLd verwijst naar de organisatie", () => {
      expect(buildWebSiteJsonLd()).toMatchObject({
        "@type": "WebSite",
        inLanguage: "nl-NL",
        publisher: { "@id": `${businessInfo.siteUrl}/#organization` },
      });
    });

    it("buildFaqJsonLd", () => {
      expect(buildFaqJsonLd([{ q: "Vraag?", a: "Antwoord." }])).toEqual({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [{ "@type": "Question", name: "Vraag?", acceptedAnswer: { "@type": "Answer", text: "Antwoord." } }],
      });
    });
  });
});
