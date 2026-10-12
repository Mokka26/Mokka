/**
 * Eén prijs-parser voor alle admin-invoer. Accepteert "599", "599,50",
 * "599.50", "€ 1.299,00" en "1299". Geeft `null` terug bij leeg, en gooit
 * nooit stil een waarde weg: een onleesbare invoer levert `{ error }`.
 */
export type ParsedPrice = { value: number | null; error?: string };

export function parsePrice(raw: FormDataEntryValue | string | null | undefined): ParsedPrice {
  if (raw == null) return { value: null };
  const s = String(raw).trim();
  if (!s) return { value: null };
  // Valuta en spaties weg; de laatste komma/punt is de decimaal.
  let cleaned = s.replace(/[€\s]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // "1.299,50" → punt is duizendtal; "1,299.50" → komma is duizendtal.
    cleaned = lastComma > lastDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    cleaned = cleaned.replace(",", ".");
  } else if (lastDot > -1 && /\.\d{3}$/.test(cleaned)) {
    // "1.299" zonder decimalen = duizendtal.
    cleaned = cleaned.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { value: null, error: `Ongeldige prijs: "${s}"` };
  const n = Math.round(parseFloat(cleaned) * 100) / 100;
  if (!Number.isFinite(n) || n < 0) return { value: null, error: `Ongeldige prijs: "${s}"` };
  return { value: n };
}

/** Verplichte prijs: leeg of onleesbaar is een fout. */
export function parseRequiredPrice(raw: FormDataEntryValue | string | null | undefined): ParsedPrice {
  const r = parsePrice(raw);
  if (r.error) return r;
  if (r.value == null) return { value: null, error: "Prijs is verplicht" };
  return r;
}
