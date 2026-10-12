import Link from "next/link";
import { productUrl } from "@/lib/categories";

export interface ColorVariant {
  id: string;
  slug: string;
  colorName: string | null;
  colorHex: string | null;
}

interface Props {
  currentSlug: string;
  currentColorName: string | null;
  category: string;
  variants: ColorVariant[];
}

/**
 * Kleurkeuze als links naar de zustervarianten (elke kleur is een eigen
 * product/URL). 44px klikgebied, zichtbare selectiering in ink, kleurnaam als
 * tekst naast de rij. Verborgen varianten filtert de page al weg.
 */
export function ColorSwatches({ currentSlug, currentColorName, category, variants }: Props) {
  if (!variants || variants.length <= 1) return null;
  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <p className="text-[14px] text-stone">
          Kleur{currentColorName ? ":" : ""}{" "}
          {currentColorName && <span className="text-ink font-medium">{currentColorName}</span>}
        </p>
        <p className="text-[14px] text-stone">{variants.length} kleuren</p>
      </div>
      <ul role="group" aria-label="Kleur" className="flex items-center gap-1 flex-wrap">
        {variants.map((v) => {
          const isCurrent = v.slug === currentSlug;
          const name = v.colorName ?? "Variant";
          return (
            <li key={v.id}>
              <Link
                href={productUrl({ category, slug: v.slug })}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={isCurrent ? `${name} (huidige kleur)` : name}
                title={name}
                className="group/swatch inline-flex items-center justify-center w-11 h-11 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  aria-hidden="true"
                  className={`block w-7 h-7 rounded-full border transition-[box-shadow,transform] duration-[280ms] ${
                    v.colorHex ? "" : "bg-stone/30"
                  } ${
                    isCurrent
                      ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper"
                      : "border-line ring-0 group-hover/swatch:ring-2 group-hover/swatch:ring-mist group-hover/swatch:ring-offset-2 group-hover/swatch:ring-offset-paper"
                  }`}
                  style={v.colorHex ? { backgroundColor: v.colorHex } : undefined}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
