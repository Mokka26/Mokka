import { withdrawalLines } from "@/lib/email";
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
