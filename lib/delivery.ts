/**
 * Bezorgvragen in de checkout (verdieping, lift) — gedeeld door het formulier
 * (app/checkout/page.tsx), de validatie (app/checkout/actions.ts), de mails en
 * de admin. Grote meubels: verdieping en lift bepalen of 2 man het kunnen dragen.
 */
export const DELIVERY_FLOORS = ["begane grond", "1e verdieping", "2e verdieping", "3e verdieping of hoger"] as const;
export type DeliveryFloor = (typeof DELIVERY_FLOORS)[number];

/** Leesbare samenvatting voor mail en admin; null als de klant niets invulde. */
export function deliverySummary(o: {
  deliveryFloor?: string | null;
  deliveryElevator?: boolean | null;
  deliveryNotes?: string | null;
  assemblyRequested?: boolean | null;
}): string[] {
  const lines: string[] = [];
  if (o.deliveryFloor) {
    const lift = o.deliveryElevator === true ? ", met lift" : o.deliveryElevator === false ? ", geen lift" : "";
    lines.push(`Verdieping: ${o.deliveryFloor}${lift}`);
  }
  if (o.assemblyRequested) lines.push("Montage gewenst (we bellen vooraf over de kosten)");
  if (o.deliveryNotes) lines.push(`Opmerking: ${o.deliveryNotes}`);
  return lines;
}
