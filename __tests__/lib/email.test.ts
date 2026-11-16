import { termsAttachment, withdrawalLines } from "@/lib/email";
import { TERMS_VERSION, termsSections } from "@/lib/terms";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";

describe("withdrawalLines (orderbevestiging)", () => {
  const text = withdrawalLines().join("\n");

  it("noemt de bedenktijd en hoe je herroept", () => {
    expect(text).toContain(`${shippingInfo.returnWindowDays} dagen bedenktijd`);
    expect(text).toContain(businessInfo.contact.email);
    expect(text).toContain(businessInfo.legal.returnPolicyUrl);
    expect(text).toContain(businessInfo.legal.termsUrl);
  });

  it("bevat het wettelijke modelformulier met de gegevens van de ondernemer", () => {
    expect(text).toContain("Modelformulier voor herroeping");
    expect(text).toContain(businessInfo.legalName);
    expect(text).toContain("Besteld op*/Ontvangen op*");
    expect(text).toContain("Doorhalen wat niet van toepassing is");
  });
});

describe("termsAttachment (AV als duurzame drager)", () => {
  it("is platte UTF-8-tekst uit dezelfde bron als de pagina, met art. 6 uit shipping-info", () => {
    const a = termsAttachment();
    expect(a.filename).toMatch(/\.txt$/);
    expect(a.contentType).toContain("utf-8");
    expect(a.content).toContain(`Versie ${TERMS_VERSION}`);
    for (const s of termsSections()) expect(a.content).toContain(s.heading);
    expect(a.content).toContain(shippingInfo.refundCopy);
    expect(a.content).toContain(`${businessInfo.siteUrl.replace(/\/$/, "")}${businessInfo.legal.returnPolicyUrl}`);
    expect(a.content).not.toMatch(/ongeopende/);
  });
});
