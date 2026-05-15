"use client";

import Link from "next/link";
import Image from "next/image";
import { cldOptimize } from "@/lib/cloudinary-url";
import { imageUrls } from "@/lib/imageHelpers";
import { useInFrameParallax } from "@/hooks/useInFrameParallax";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  images: string;
  featured?: boolean;
  createdAt?: Date | string;
  stock?: number;
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  specs?: string | null;
}

interface ProductSpecs {
  serie?: string;
  categorie?: string;
  afmetingen?: string;
  materiaal?: string;
  stoffering?: string;
  kleur?: string;
  patroon?: string;
}

function parseSpecs(specs?: string | null): ProductSpecs {
  if (!specs) return {};
  try {
    const p = JSON.parse(specs);
    const lookup = (...keys: string[]) => {
      for (const k of keys) {
        const direct = p[k];
        if (direct) return String(direct);
        const lower = k.toLowerCase();
        for (const [key, val] of Object.entries(p)) {
          if (key.toLowerCase() === lower && val) return String(val);
        }
      }
      return undefined;
    };
    return {
      serie: lookup("Serie", "serie", "Series"),
      categorie: lookup("Categorie", "Category"),
      afmetingen: lookup("Afmetingen", "Afmeting", "Maten", "Maat", "Size"),
      materiaal: lookup("Materiaal", "Material"),
      stoffering: lookup("Stoffering", "Bekleding"),
      kleur: lookup("Kleur", "Color", "Colour"),
      patroon: lookup("Patroon", "Pattern"),
    };
  } catch {
    return {};
  }
}

type ColorVariant = {
  slug: string;
  colorName: string | null;
  colorHex: string | null;
};

interface Props {
  product: Product;
  variants?: ColorVariant[];
}

function getBadge(product: Product): string | null {
  if (product.stock === 0) return "Uitverkocht";
  if (!product.createdAt) return product.featured ? "Uitgelicht" : null;
  const created = typeof product.createdAt === "string" ? new Date(product.createdAt) : product.createdAt;
  const daysSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 30) return "Nieuw";
  if (product.featured) return "Uitgelicht";
  return null;
}

export default function ProductCard({ product, variants }: Props) {
  const urls = imageUrls(product.images);
  const firstRaw = urls[0] ?? "";
  const first = firstRaw ? cldOptimize(firstRaw, { w: 900 }) : "";

  const badge = getBadge(product);
  const isOutOfStock = product.stock === 0;
  const { ref: figureRef, onMouseMove, onMouseLeave } = useInFrameParallax<HTMLElement>({ maxOffset: 10 });

  const displayName = variants && variants.length > 1 && product.colorName
    ? product.name.replace(new RegExp(`\\s*${product.colorName}$`, "i"), "")
    : product.name;

  const s = parseSpecs(product.specs);
  const eyebrow = s.serie ?? product.category;
  const titleParts = [s.categorie ?? displayName];
  if (s.afmetingen) titleParts.push(s.afmetingen);
  const title = s.categorie ? titleParts.join(" · ") : displayName;
  const subParts: string[] = [];
  const addUnique = (val?: string) => {
    if (!val) return;
    const joined = subParts.join(" ").toLowerCase();
    if (!joined.includes(val.toLowerCase())) subParts.push(val);
  };
  addUnique(s.materiaal);
  addUnique(s.stoffering);
  addUnique(s.patroon);
  addUnique(s.kleur);
  const subtitle = subParts.join(" · ");

  return (
    <article className="product-card group">
      <Link href={`/products/${product.slug}`} className="block">
        {/* Image — aspect 4/5 magazine-feel, in-frame parallax, geen ring/rounded */}
        <figure
          ref={figureRef}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          className="relative aspect-[4/5] overflow-hidden bg-bone mb-6 rounded-[10px]"
        >
          {first && (
            <Image
              src={first}
              alt={product.name}
              fill
              loading="lazy"
              className="object-cover"
              style={{
                transform: "translate(var(--parallax-x, 0px), var(--parallax-y, 0px)) scale(1.06)",
                transition: "transform 480ms cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform",
              }}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          )}

          {/* Badge — square, minimal */}
          {badge && (
            <div className="absolute top-4 left-4 z-10">
              <span className={`inline-block text-[10px] uppercase tracking-[0.14em] font-medium px-2.5 py-1 ${
                isOutOfStock
                  ? "bg-paper/90 text-stone backdrop-blur-sm"
                  : "bg-paper/95 text-ink backdrop-blur-sm"
              }`}>
                {badge}
              </span>
            </div>
          )}

          {isOutOfStock && (
            <div className="absolute inset-0 bg-paper/45 z-[5] pointer-events-none" />
          )}
        </figure>

        {/* Info block — left-aligned, hairline-marker signature */}
        <div className="text-left">
          {/* Eyebrow — serie of categorie */}
          <p className="text-[10px] text-stone uppercase tracking-[0.14em] font-medium mb-2">
            {eyebrow}
          </p>

          {/* Hoofdnaam — groot serif, Fraunces opsz 96 */}
          <h3
            className="font-serif text-xl sm:text-2xl text-ink leading-[1.05] tracking-[-0.025em] transition-colors duration-[280ms]"
            style={{
              fontVariationSettings: '"opsz" 96',
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <span className="card-name">{title}</span>
          </h3>

          {/* SIGNATURE: 16px hairline-marker in accent-light tussen naam en subtitle */}
          <div className="w-4 h-px bg-[var(--color-accent-light)] my-4" />

          {subtitle && (
            <p className="text-sm text-stone leading-[1.45] mb-3">{subtitle}</p>
          )}

          <div className="flex items-baseline justify-between gap-3 pt-1">
            <p className="font-serif text-lg sm:text-xl text-ink whitespace-nowrap tabular-nums tracking-[-0.025em]" style={{ fontVariationSettings: '"opsz" 48' }}>
              &euro;{product.price.toFixed(0)},-
            </p>
            {!isOutOfStock ? (
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-medium text-stone">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                Op voorraad
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-medium text-stone/60">
                <span className="w-1.5 h-1.5 rounded-full bg-stone/40" />
                Uitverkocht
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Kleur-varianten onder de kaart */}
      {variants && variants.length > 1 && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {variants.map((v) => {
              const isCurrent = v.slug === product.slug;
              return (
                <Link
                  key={v.slug}
                  href={`/products/${v.slug}`}
                  title={v.colorName ?? ""}
                  aria-label={v.colorName ?? "Variant"}
                  className={`block w-4 h-4 rounded-full border transition-all duration-[280ms] ${
                    isCurrent
                      ? "border-ink scale-110"
                      : "border-line hover:border-accent hover:scale-110"
                  }`}
                  style={{
                    backgroundColor: v.colorHex ?? "#CFCFCF",
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
              );
            })}
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] font-medium text-stone">
            {variants.length} kleuren
          </span>
        </div>
      )}
    </article>
  );
}
