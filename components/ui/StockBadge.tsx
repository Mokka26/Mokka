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
  /** `sm` = kaart (14px), `md` = PDP (16px). */
  size?: "sm" | "md";
  /** Levertijd van het product: in weken = "Op bestelling" (zie /bezorging). */
  deliveryTime?: string | null;
  className?: string;
}

/**
 * Levertijd in weken = wordt voor je besteld/gemaakt, niet uit eigen magazijn.
 * /bezorging belooft drie statussen: op voorraad (dagen), op bestelling en
 * maatwerk (weken). "Op voorraad" naast "4 tot 8 weken" wekt valse verwachting.
 */
export function isOnOrder(deliveryTime: string | null | undefined): boolean {
  return /\bweken?\b/i.test(deliveryTime ?? "");
}

export function stockLabel(stock: number | null | undefined, showLow = false, deliveryTime?: string | null): string {
  const s = stock ?? 1;
  if (s <= 0) return "Uitverkocht";
  if (isOnOrder(deliveryTime)) return "Op bestelling";
  if (showLow && s <= 3) return `Nog ${s} op voorraad`;
  return "Op voorraad";
}

export function StockBadge({ stock, showLow = false, size = "sm", deliveryTime, className = "" }: Props) {
  const inStock = (stock ?? 1) > 0;
  const onOrder = inStock && isOnOrder(deliveryTime);
  const label = stockLabel(stock, showLow, deliveryTime);
  return (
    <span
      className={`inline-flex items-center gap-2 ${
        size === "md" ? "text-base" : "text-sm"
      } ${inStock ? "text-ink" : "text-stone"} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`w-2 h-2 rounded-full shrink-0 ${onOrder ? "bg-warning" : inStock ? "bg-success" : "bg-stone/50"}`}
      />
      <span className="sr-only">Voorraad: </span>
      {label}
    </span>
  );
}
