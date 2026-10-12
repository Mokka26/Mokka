/**
 * Voorraadstatus als tekst (≥13px) — op ProductCard én PDP (CLAUDE.md §9).
 *
 * De eigenaar beheert de voorraad handmatig; "Nog X op voorraad" (≤3) is dus
 * echte data, geen kunstmatige schaarste.
 */
interface Props {
  /** Ontbrekende voorraad (niet geselecteerd in de query) telt als op voorraad. */
  stock?: number | null;
  /** Toon de exacte rest bij ≤3 stuks (alleen op de PDP). */
  showLow?: boolean;
  /** `sm` = kaart (13px), `md` = PDP (16px). */
  size?: "sm" | "md";
  className?: string;
}

export function stockLabel(stock: number | null | undefined, showLow = false): string {
  const s = stock ?? 1;
  if (s <= 0) return "Uitverkocht";
  if (showLow && s <= 3) return `Nog ${s} op voorraad`;
  return "Op voorraad";
}

export function StockBadge({ stock, showLow = false, size = "sm", className = "" }: Props) {
  const inStock = (stock ?? 1) > 0;
  const label = stockLabel(stock, showLow);
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap ${
        size === "md" ? "text-base" : "text-[13px]"
      } ${inStock ? "text-ink" : "text-stone"} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`w-2 h-2 rounded-full shrink-0 ${inStock ? "bg-success" : "bg-stone/50"}`}
      />
      <span className="sr-only">Voorraad: </span>
      {label}
    </span>
  );
}
