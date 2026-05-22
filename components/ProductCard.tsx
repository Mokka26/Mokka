"use client";

import Link from "next/link";
import Image from "next/image";
import { cldOptimize } from "@/lib/cloudinary-url";
import { imageUrls, parseImages } from "@/lib/imageHelpers";
import { dbCategoryToRouteSlug, productUrl } from "@/lib/categories";
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
  /** Eerste card op een listing → priority + eager loading voor LCP */
  priority?: boolean;
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

export default function ProductCard({ product, variants, priority = false }: Props) {
  const parsed = parseImages(product.images);
  const urls = imageUrls(product.images);
  const firstRaw = urls[0] ?? "";
  // Adaptive aspect: portrait source → c_pad (bank volledig zichtbaar, edge-color padding),
  // landscape/square source → c_fill (smart-crop op subject)
  const firstDim = parsed[0];
  const isPortrait = !!(firstDim?.w && firstDim?.h && firstDim.h > firstDim.w * 1.1);
  const first = firstRaw
    ? cldOptimize(firstRaw, {
        ar: "3:2",
        w: 1400,
        mode: isPortrait ? "pad" : "fill",
        upscale: !isPortrait,
        sourceW: firstDim?.w,
        quality: "auto:good",
      })
    : "";

  const badge = getBadge(product);
  const isOutOfStock = product.stock === 0;
  const { ref: figureRef, onMouseMove, onMouseLeave } = useInFrameParallax<HTMLElement>({ maxOffset: 10 });

  const displayName = variants && variants.length > 1 && product.colorName
    ? product.name.replace(new RegExp(`\\s*${product.colorName}$`, "i"), "")
    : product.name;

  const s = parseSpecs(product.specs);
  const eyebrow = s.serie ?? product.category;
  // Titel = ENKEL productnaam. Afmetingen + materiaal staan in gestructureerd
  // info-blok eronder, niet meer in title-regel.
  const title = displayName;

  // Materiaal-regel: dedupe waardes die elkaar overlappen (bv "Stof" + "Stoffering")
  const materialParts: string[] = [];
  const addUnique = (val?: string) => {
    if (!val) return;
    const joined = materialParts.join(" ").toLowerCase();
    if (!joined.includes(val.toLowerCase())) materialParts.push(val);
  };
  addUnique(s.materiaal);
  addUnique(s.stoffering);
  addUnique(s.patroon);
  const materialLine = materialParts.join(" · ");

  // Color swatches: max 4 dots, rest als "+N"
  const colorDots = variants && variants.length > 1
    ? variants.filter((v) => v.colorHex).slice(0, 4)
    : [];
  const extraColors = variants && variants.length > 4 ? variants.length - 4 : 0;

  return (
    <article className="product-card group">
      <Link href={productUrl(product)} className="block">
        {/* Image — aspect 4/5 magazine-feel, in-frame parallax, geen ring/rounded */}
        <figure
          ref={figureRef}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          className="relative aspect-[3/2] overflow-hidden bg-bone mb-6 rounded-[10px]"
        >
          {first && (
            <Image
              src={first}
              alt={product.name}
              fill
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              unoptimized
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

        {/* Info block — left-aligned, gestructureerd label/value pattern */}
        <div className="text-left">
          {/* Eyebrow — serie of categorie */}
          <p className="text-[10px] text-stone uppercase tracking-[0.14em] font-medium mb-2">
            {eyebrow}
          </p>

          {/* Hoofdnaam — alleen productnaam, geen afmetingen */}
          <h3 className="font-serif text-xl sm:text-2xl text-ink leading-[1.15] tracking-[-0.015em] mb-3">
            <span className="card-name">{title}</span>
          </h3>

          {/* SIGNATURE: hairline-marker */}
          <div className="w-4 h-px bg-[var(--color-accent-light)] mb-4" />

          {/* Spec-grid: label kort/uppercase links, value rechts */}
          {(s.afmetingen || materialLine || colorDots.length > 0) && (
            <dl className="space-y-1.5 mb-4 text-sm leading-[1.4]">
              {s.afmetingen && (
                <div className="flex items-baseline gap-3">
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-stone w-[68px] flex-shrink-0">Afmeting</dt>
                  <dd className="text-ink tabular-nums">{s.afmetingen}</dd>
                </div>
              )}
              {materialLine && (
                <div className="flex items-baseline gap-3">
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-stone w-[68px] flex-shrink-0">Materiaal</dt>
                  <dd className="text-ink">{materialLine}</dd>
                </div>
              )}
              {colorDots.length > 0 && (
                <div className="flex items-baseline gap-3">
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-stone w-[68px] flex-shrink-0">Kleuren</dt>
                  <dd className="flex items-center gap-1.5">
                    {colorDots.map((v) => (
                      <span
                        key={v.slug}
                        title={v.colorName ?? ""}
                        className="w-3.5 h-3.5 rounded-full border border-line"
                        style={{ backgroundColor: v.colorHex ?? "transparent" }}
                      />
                    ))}
                    {extraColors > 0 && (
                      <span className="text-[10px] uppercase tracking-[0.14em] text-stone ml-0.5">+{extraColors}</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {/* Footer: prijs + voorraad */}
          <div className="flex items-baseline justify-between gap-3 pt-1 border-t border-line/60 mt-1">
            <p className="font-serif text-lg sm:text-xl text-ink whitespace-nowrap tabular-nums tracking-[-0.015em] mt-3">
              &euro; {product.price.toFixed(0)},-
            </p>
            {!isOutOfStock ? (
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-medium text-stone mt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                Op voorraad
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-medium text-stone/60 mt-3">
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
                  href={`/${dbCategoryToRouteSlug(product.category)}/${v.slug}`}
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
