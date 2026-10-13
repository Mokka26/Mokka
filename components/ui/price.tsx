import { shippingInfo } from "@/lib/shipping-info";

/**
 * Gedeelde prijs-component — bron van waarheid voor prijsweergave (CLAUDE.md §9).
 * Gebruikt op ProductCard, PDP (hoofdprijs + sticky), CartDrawer, cart- en
 * checkout-regels zodat notatie overal gelijk is.
 *
 * - NL-notatie via Intl.NumberFormat('nl-NL') → "€ 2.999" / "€ 1.499,50"
 * - Hele bedragen tonen geen decimalen, anders twee (nl-komma)
 * - `vat` toont het "incl. btw"-label (verplicht op kaart + PDP), ≥13px
 * - `listPrice` > `price` → "Adviesprijs € X" doorgestreept + besparing in %
 *   (`showSavings={false}` laat het percentage weg, bv. op de kaart)
 * - `from` → "vanaf" (producten met maatvarianten)
 * - `price` ≤ 0 → "Prijs op aanvraag" (nooit "€ 0" met btw-label)
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
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? nfWhole.format(rounded) : nfCents.format(rounded);
}

/** Besparing in hele procenten; 0 als er geen korting is. */
export function discountPercent(price: number, listPrice: number | null | undefined): number {
  if (listPrice == null || !(listPrice > price) || !(price > 0)) return 0;
  return Math.round(((listPrice - price) / listPrice) * 100);
}

export type PriceSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<PriceSize, string> = {
  sm: "text-base sm:text-lg",
  md: "text-xl",
  lg: "text-2xl lg:text-3xl",
  xl: "text-3xl lg:text-4xl",
};

const LIST_SIZE_CLASS: Record<PriceSize, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

export const PRICE_ON_REQUEST_LABEL = "Prijs op aanvraag";

interface PriceProps {
  /** Verkoopprijs (incl. btw). */
  price?: number;
  /** @deprecated Gebruik `price`. */
  value?: number;
  /** Adviesprijs; indien > price toont de component korting (doorgestreept). */
  listPrice?: number | null;
  /** Toon "incl. btw"-label onder de prijs. */
  vat?: boolean;
  /** "vanaf" vóór de prijs (producten met maatvarianten). */
  from?: boolean;
  size?: PriceSize;
  /** Extra classes op de prijs zelf (kleur/font). Default: serif, ink. */
  className?: string;
  /** Classes op het btw-label; default ≥13px text-stone. */
  vatClassName?: string;
  /** Richting van de stapel: kolom (default) of op één regel. */
  inline?: boolean;
  /**
   * Toon "-16%" naast de doorgestreepte adviesprijs. ProductCard zet dit uit:
   * daar staat het percentage al als badge op de foto.
   */
  showSavings?: boolean;
}

export function Price({
  price,
  value,
  listPrice = null,
  vat = false,
  from = false,
  size = "md",
  className = "",
  vatClassName = "",
  inline = false,
  showSavings = true,
}: PriceProps) {
  const amount = price ?? value ?? 0;
  const priceClass = `font-serif text-ink tabular-nums tracking-[-0.015em] ${SIZE_CLASS[size]} ${className}`.trim();

  // Vangnet: een product zonder geldige prijs toont nooit "€ 0" met btw-label,
  // maar "Prijs op aanvraag" (bv. dealer-import die nog geprijsd moet worden).
  if (amount <= 0) {
    return <span className={priceClass}>{PRICE_ON_REQUEST_LABEL}</span>;
  }

  const pct = discountPercent(amount, listPrice);
  const hasDiscount = pct > 0 && listPrice != null;
  const vatLabel = (
    <span className={vatClassName || "text-[13px] leading-snug text-stone"}>{shippingInfo.vatLabelShort}</span>
  );

  return (
    <span className={inline ? "inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5" : "inline-flex flex-col gap-0.5"}>
      {hasDiscount && (
        <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${LIST_SIZE_CLASS[size]} text-stone`}>
          <s className="tabular-nums">Adviesprijs {formatPrice(listPrice)}</s>
          {showSavings && (
            <span className="font-medium text-success whitespace-nowrap">
              -{pct}%<span className="sr-only"> korting</span>
            </span>
          )}
        </span>
      )}
      <span className="inline-flex items-baseline gap-2">
        {from && <span className="text-[13px] text-stone">vanaf</span>}
        <span className={priceClass}>{formatPrice(amount)}</span>
        {inline && vat && vatLabel}
      </span>
      {!inline && vat && vatLabel}
    </span>
  );
}
