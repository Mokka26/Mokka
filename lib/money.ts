/**
 * Geldrekenen in hele centen (integers). Floats als 0.1 + 0.2 geven
 * afrondingsruis; bij Mollie Orders/Klarna moeten regels exact optellen tot
 * het totaal, dus alle optellingen en btw-uitsplitsingen gebeuren in centen.
 */

/** Euro's (float) → centen (integer, afgerond op de dichtstbijzijnde cent). */
export function toCents(amount: number): number {
  // Twee stappen: 1.005 * 100 = 100.4999… in floats; via tienden van centen
  // rondt het correct naar 101.
  return Math.round(Math.round(amount * 1000) / 10);
}

/** Centen (integer) → euro's (float, exact 2 decimalen representeerbaar). */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Rond een euro-bedrag af op 2 decimalen via centen. */
export function round2(amount: number): number {
  return fromCents(toCents(amount));
}

/**
 * Btw-deel van een bruto bedrag (incl. btw) in centen, afgerond op een hele
 * cent. Bv. 12100 cent bij 21% → 2100 cent.
 */
export function vatFromGrossCents(grossCents: number, ratePercent: number): number {
  return Math.round((grossCents * ratePercent) / (100 + ratePercent));
}

/** Mollie-notatie: string met exact 2 decimalen ("799.00") uit centen. */
export function centsToMollieValue(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Nederlandse weergave uit centen: "€ 1.299,00". */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(
    fromCents(cents),
  );
}
