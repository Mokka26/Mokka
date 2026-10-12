"use client";

import { Minus, Plus } from "lucide-react";

interface Props {
  value: number;
  onChange: (next: number) => void;
  /** Naam van het product — gaat in de aria-labels van de knoppen. */
  name: string;
  min?: number;
  max?: number;
  /** Bij `true` zijn beide knoppen uitgeschakeld (bv. uitverkocht). */
  disabled?: boolean;
  /** Compact (44px hoog) voor drawer/regels; `md` is de PDP-variant. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Toegankelijke aantal-kiezer: role=group, knoppen van minimaal 44×44px met
 * beschrijvende aria-labels en een aria-live-waarde zodat screenreaders de
 * wijziging horen. Eén component voor PDP, drawer en cart-pagina.
 */
export function QuantityStepper({
  value,
  onChange,
  name,
  min = 1,
  max = 99,
  disabled = false,
  size = "sm",
  className = "",
}: Props) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;
  const btn =
    "inline-flex items-center justify-center min-w-11 min-h-11 text-ink transition-colors duration-[280ms] hover:bg-bone hover:text-accent disabled:text-stone/50 disabled:hover:bg-transparent disabled:cursor-not-allowed";
  const height = size === "md" ? "h-[52px]" : "h-11";

  return (
    <div
      role="group"
      aria-label={`Aantal voor ${name}`}
      className={`inline-flex items-stretch border border-line rounded-[10px] overflow-hidden bg-white ${height} ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={!canDecrease}
        aria-label={`Aantal verlagen voor ${name}`}
        className={btn}
      >
        <Minus className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
      <span
        aria-live="polite"
        aria-atomic="true"
        className="inline-flex items-center justify-center min-w-11 px-2 text-base text-ink tabular-nums border-x border-line"
      >
        <span className="sr-only">Aantal: </span>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={!canIncrease}
        aria-label={`Aantal verhogen voor ${name}`}
        className={btn}
      >
        <Plus className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
