import Link from "next/link";
import { productUrl } from "@/lib/categories";
import { buildVariantOptions, type ModelVariant } from "@/lib/variants";
import { formatPrice } from "@/components/ui/price";

interface Props {
  currentSlug: string;
  category: string;
  /** Alle (zichtbare) varianten van het model, incl. het huidige product. */
  variants: ModelVariant[];
}

const LABEL = "text-[15px] text-stone mb-3";

/**
 * Maat- en kleurkeuze voor één model. Elke optie is een link naar het
 * product van die maat/kleur (eigen URL, prijs en voorraad).
 * - Maat: blijft in dezelfde kleur als die in de gekozen maat bestaat.
 * - Kleur: alleen de kleuren die in de huidige maat leverbaar zijn.
 * `scroll={false}`: de klant blijft bij de keuze staan i.p.v. naar boven te
 * springen; alleen de inhoud (foto's, prijs) wisselt.
 */
export function VariantPicker({ currentSlug, category, variants }: Props) {
  const { sizes, colors } = buildVariantOptions(variants, currentSlug);
  if (sizes.length === 0 && colors.length === 0) return null;
  const currentSize = sizes.find((s) => s.current);
  const currentColor = colors.find((c) => c.current);

  return (
    <div className="mb-6 space-y-6">
      {sizes.length > 0 && (
        <div role="group" aria-labelledby="pdp-model-size-label">
          <p id="pdp-model-size-label" className={LABEL}>
            Maat{currentSize ? ": " : ""}
            {currentSize && <span className="text-ink font-medium">{currentSize.label}</span>}
          </p>
          <ul className="flex flex-wrap gap-2 list-none">
            {sizes.map((s) => (
              <li key={s.label}>
                <Link
                  href={productUrl({ category, slug: s.slug })}
                  scroll={false}
                  aria-current={s.current ? "page" : undefined}
                  className={`inline-flex flex-col items-start justify-center gap-0.5 px-4 py-2 min-h-11 min-w-[6.5rem] rounded-[8px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    s.current ? "bg-ink text-paper border-ink" : "bg-transparent text-ink border-line-strong hover:border-ink"
                  }`}
                >
                  <span className="text-base leading-tight tabular-nums">{s.label}</span>
                  <span className={`text-[14px] leading-tight tabular-nums ${s.current ? "text-paper/85" : "text-slate"}`}>
                    {!s.inStock ? "Uitverkocht" : s.price > 0 ? formatPrice(s.price) : "Prijs op aanvraag"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {colors.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <p id="pdp-model-color-label" className="text-[15px] text-stone">
              Kleur{currentColor?.colorName ? ": " : ""}
              {currentColor?.colorName && <span className="text-ink font-medium">{currentColor.colorName}</span>}
            </p>
            <p className="text-[15px] text-stone">
              {colors.length} kleuren{sizes.length > 0 ? " in deze maat" : ""}
            </p>
          </div>
          <ul aria-labelledby="pdp-model-color-label" className="flex items-center gap-1 flex-wrap list-none">
            {colors.map((c) => {
              const name = c.colorName ?? "Variant";
              const label = `${name}${c.current ? " (gekozen)" : ""}${c.inStock ? "" : ", uitverkocht"}`;
              return (
                <li key={c.slug}>
                  <Link
                    href={productUrl({ category, slug: c.slug })}
                    scroll={false}
                    aria-current={c.current ? "page" : undefined}
                    aria-label={label}
                    title={label}
                    className="group/swatch inline-flex items-center justify-center w-11 h-11 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span
                      aria-hidden="true"
                      className={`block w-7 h-7 rounded-full border transition-[box-shadow,transform] duration-[280ms] ${
                        c.colorHex ? "" : "bg-mist"
                      } ${c.inStock ? "" : "opacity-45"} ${
                        c.current
                          ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper"
                          : "border-line ring-0 group-hover/swatch:ring-2 group-hover/swatch:ring-mist group-hover/swatch:ring-offset-2 group-hover/swatch:ring-offset-paper"
                      }`}
                      style={c.colorHex ? { backgroundColor: c.colorHex } : undefined}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
