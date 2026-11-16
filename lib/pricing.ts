/**
 * Regelprijs van één winkelwagenregel (maat + nachtkast + voetbank), puur en
 * zonder Prisma of Next-runtime. Eén bron voor de productpagina (wat de klant
 * ziet), de cart-sync en de checkout (wat de klant betaalt): beide moeten
 * altijd hetzelfde bedrag geven.
 *
 * Maatlabels worden via `parseSizeVariants` (lib/specs.ts) gelezen en getrimd
 * vergeleken, net als op de PDP.
 */

import { parseSizeVariants } from "@/lib/specs";
import { toCents } from "@/lib/money";

/** Minimale productvelden die nodig zijn om één regel te prijzen. */
export type PriceableProduct = {
  price: number;
  sizeVariants: string | null;
  nachtkastMode: string | null;
  nachtkastPrice: number | null;
  nachtkastPrice2: number | null;
  voetbankMode: string | null;
  voetbankPrice: number | null;
};

export type LineOptions = { variantLabel?: string | null; nachtkast?: number; voetbank?: number };

export type LinePricing =
  | { ok: true; unitCents: number; variantLabel: string | null; fullLabel: string | null }
  | { ok: false; reason: "VARIANT_MISSING" | "NO_PRICE"; corrupt?: boolean };

/**
 * Maatvarianten van een product. `null` = kapotte data (geen JSON of geen
 * lijst): dan mag er NIET stil op de basisprijs worden teruggevallen.
 */
export function readSizeVariants(raw: string | null | undefined): ReturnType<typeof parseSizeVariants> | null {
  if (!raw || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parseSizeVariants(raw);
}

/** Toeslag in euro's voor 0, 1 of 2 nachtkasten (0 als de modus niet "optional" is). */
export function nachtkastAddon(
  p: { nachtkastMode?: string | null; nachtkastPrice?: number | null; nachtkastPrice2?: number | null },
  n: number,
): number {
  if (p.nachtkastMode !== "optional" || n <= 0) return 0;
  const single = p.nachtkastPrice ?? 0;
  if (n === 1) return single;
  return p.nachtkastPrice2 ?? single * 2;
}

/** Toeslag in euro's voor een voetbank (0 als de modus niet "optional" is). */
export function voetbankAddon(p: { voetbankMode?: string | null; voetbankPrice?: number | null }, n: number): number {
  if (p.voetbankMode !== "optional" || n <= 0) return 0;
  return p.voetbankPrice ?? 0;
}

/** Klemt het gevraagde aantal nachtkasten (0-2) en voetbanken (0-1); 0 als de optie niet los te bestellen is. */
export function clampOptions(p: { nachtkastMode?: string | null; voetbankMode?: string | null }, opts: LineOptions): { nk: number; vb: number } {
  const nk = p.nachtkastMode === "optional" ? Math.max(0, Math.min(2, Math.floor(opts.nachtkast ?? 0))) : 0;
  const vb = p.voetbankMode === "optional" ? Math.max(0, Math.min(1, Math.floor(opts.voetbank ?? 0))) : 0;
  return { nk, vb };
}

/**
 * Prijst één regel vers uit de productdata.
 * - Product met maten maar zonder (bestaand) maatlabel → VARIANT_MISSING.
 * - Kapotte maatdata → VARIANT_MISSING met `corrupt: true` (aanroeper meldt).
 * - Geen positieve verkoopprijs, of een gekozen nachtkast/voetbank zonder
 *   positieve toeslag → NO_PRICE (nooit gratis meeleveren).
 */
export function priceLine(p: PriceableProduct, opts: LineOptions): LinePricing {
  const label = opts.variantLabel?.trim() || null;
  const variants = readSizeVariants(p.sizeVariants);
  if (variants === null) return { ok: false, reason: "VARIANT_MISSING", corrupt: true };

  let sizePrice = p.price;
  if (variants.length > 0) {
    if (!label) return { ok: false, reason: "VARIANT_MISSING" };
    const match = variants.find((v) => v.label === label);
    if (!match) return { ok: false, reason: "VARIANT_MISSING" };
    sizePrice = match.price ?? p.price;
  }
  if (!(sizePrice > 0)) return { ok: false, reason: "NO_PRICE" };

  const { nk, vb } = clampOptions(p, opts);
  const nkAddon = nachtkastAddon(p, nk);
  const vbAddon = voetbankAddon(p, vb);
  if ((nk > 0 && !(nkAddon > 0)) || (vb > 0 && !(vbAddon > 0))) return { ok: false, reason: "NO_PRICE" };

  const unitCents = toCents(sizePrice) + toCents(nkAddon) + toCents(vbAddon);
  const extras = [nk > 0 ? `${nk} nachtkast${nk > 1 ? "en" : ""}` : "", vb > 0 ? "voetbank" : ""].filter(Boolean).join(" · ");
  const fullLabel = extras ? `${label ?? ""}${label ? " · " : ""}${extras}`.trim() : label;
  return { ok: true, unitCents, variantLabel: label, fullLabel };
}
