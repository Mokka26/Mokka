import { shippingInfo, formatShippingCost, isEligibleForFreeShipping, getUspsByKey, warrantyYearsFor } from "@/lib/shipping-info";
import {
  businessInfo,
  getFullAddress,
  getMapsUrl,
  getPhoneLink,
  getEmailLink,
  getActiveSocials,
  getOpeningHoursCompact,
} from "@/lib/business-info";

describe("lib/shipping-info", () => {
  it("bron van waarheid: drempel, tarief, btw en retourtermijn zijn consistent met de copy", () => {
    expect(shippingInfo.freeShippingThreshold).toBeGreaterThan(0);
    expect(shippingInfo.freeShippingCopyShort).toContain(String(shippingInfo.freeShippingThreshold));
    expect(shippingInfo.vatLabelLong).toContain(String(shippingInfo.vatRatePercent));
    expect(shippingInfo.returnCopyShort).toContain(String(shippingInfo.returnWindowDays));
    expect(shippingInfo.rates.standard).toBeGreaterThan(0);
  });

  it("formatShippingCost", () => {
    expect(formatShippingCost(0)).toBe("Gratis");
    expect(formatShippingCost(4.95)).toBe("€ 4,95");
    expect(formatShippingCost(10)).toBe("€ 10,00");
  });

  it("isEligibleForFreeShipping: vanaf de drempel in NL/BE, nooit daarbuiten", () => {
    const t = shippingInfo.freeShippingThreshold;
    expect(isEligibleForFreeShipping(t)).toBe(true);
    expect(isEligibleForFreeShipping(t - 0.01)).toBe(false);
    expect(isEligibleForFreeShipping(t, "BE")).toBe(true);
    expect(isEligibleForFreeShipping(t * 10, "DE")).toBe(false);
  });

  it("getUspsByKey filtert op sleutel in display-volgorde", () => {
    expect(getUspsByKey("return", "shipping").map((u) => u.key)).toEqual(["shipping", "return"]);
    expect(getUspsByKey()).toEqual([]);
  });

  it("warrantyYearsFor: per categorie, anders de default", () => {
    expect(warrantyYearsFor("bedden")).toBe(shippingInfo.warrantyByCategory.bedden);
    expect(warrantyYearsFor("slaapkamers")).toBe(0);
    expect(warrantyYearsFor("banken")).toBe(shippingInfo.warrantyYears);
  });
});

describe("lib/business-info", () => {
  it("getFullAddress / getMapsUrl", () => {
    const { street, postalCode, city } = businessInfo.address;
    expect(getFullAddress()).toBe(`${street}, ${postalCode} ${city}`);
    expect(getMapsUrl()).toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getFullAddress())}`);
  });

  it("getPhoneLink geeft een tel:-link zonder spaties/streepjes", () => {
    const link = getPhoneLink();
    if (!businessInfo.contact.phone) {
      expect(link).toBeNull();
      return;
    }
    expect(link).toMatch(/^tel:\+?\d+$/);
  });

  it("getEmailLink", () => {
    expect(getEmailLink()).toBe(`mailto:${businessInfo.contact.email}`);
    expect(getEmailLink("info")).toBe(`mailto:${businessInfo.contact.email}`);
    if (businessInfo.contact.supportEmail) expect(getEmailLink("support")).toBe(`mailto:${businessInfo.contact.supportEmail}`);
    else expect(getEmailLink("support")).toBeNull();
  });

  it("getActiveSocials laat null-kanalen weg", () => {
    const active = getActiveSocials();
    const expected = Object.entries(businessInfo.socials).filter(([, url]) => url !== null).length;
    expect(active).toHaveLength(expected);
    for (const s of active) expect(s.url).toMatch(/^https?:\/\//);
  });

  it("getOpeningHoursCompact groepeert opeenvolgende gelijke dagen", () => {
    const lines = getOpeningHoursCompact();
    expect(lines.length).toBeGreaterThan(0);
    // Ma–Vr hebben dezelfde tijden in business-info → één regel "Ma–Vr …"
    expect(lines[0]).toBe(`Ma–Vr ${businessInfo.openingHours.monday}`);
    expect(lines.some((l) => l.startsWith("Zo"))).toBe(businessInfo.openingHours.sunday !== null);
  });
});
