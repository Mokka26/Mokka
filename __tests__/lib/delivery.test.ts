import { deliverySummary } from "@/lib/delivery";

describe("deliverySummary", () => {
  it("vat verdieping, lift, montage en opmerking samen", () => {
    expect(
      deliverySummary({ deliveryFloor: "2e verdieping", deliveryElevator: false, assemblyRequested: true, deliveryNotes: "Smalle trap" }),
    ).toEqual(["Verdieping: 2e verdieping, geen lift", "Montage gewenst (we bellen vooraf over de kosten)", "Opmerking: Smalle trap"]);
  });

  it("is leeg als de klant niets invulde (bestaande orders)", () => {
    expect(deliverySummary({ assemblyRequested: false })).toEqual([]);
    expect(deliverySummary({})).toEqual([]);
  });
});
