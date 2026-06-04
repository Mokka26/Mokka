import { shippingInfo } from "@/lib/shipping-info";

/**
 * Gedeelde prijs-component — bron van waarheid voor prijsweergave (CLAUDE.md §9).
 * Gebruikt op ProductCard én PDP zodat notatie consistent is.
 *
 * - NL-notatie via Intl.NumberFormat('nl-NL') → "€ 2.999" / "€ 1.499,50"
 * - Hele bedragen tonen geen decimalen, anders twee (nl-komma)
 * - `vat` toont het "incl. btw"-label (verplicht op kaart + PDP)
 */
const nfWhole = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const nfCents = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(value: number): string {
  return Number.isInteger(value) ? nfWhole.format(value) : nfCents.format(value);
}

export function Price({
  value,
  vat = false,
  className = "",
  vatClassName = "",
}: {
  value: number;
  /** Toon "incl. btw"-label onder/naast de prijs */
  vat?: boolean;
  className?: string;
  vatClassName?: string;
}) {
  // Vangnet: een product zonder geldige prijs toont nooit "€ 0" met btw-label,
  // maar "Prijs op aanvraag" (bv. dealer-import die nog geprijsd moet worden).
  if (value <= 0) {
    return <span className={className}>Prijs op aanvraag</span>;
  }

  return (
    <span className="inline-flex flex-col">
      <span className={className}>{formatPrice(value)}</span>
      {vat && (
        <span className={vatClassName || "text-[11px] text-slate leading-none mt-0.5"}>
          {shippingInfo.vatLabelShort}
        </span>
      )}
    </span>
  );
}
