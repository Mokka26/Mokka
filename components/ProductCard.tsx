"use client";

import Link from "next/link";
import Image from "next/image";
import { cldOptimize } from "@/lib/cloudinary-url";
import { imageUrls } from "@/lib/imageHelpers";

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

// Parse specs JSON naar gestructureerde info (case-insensitive)
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
    // Case-insensitive lookup helper
    const lookup = (...keys: string[]) => {
      for (const k of keys) {
        const direct = p[k];
        if (direct) return String(direct);
        // Probeer case-insensitive match
        const lower = k.toLowerCase();
        for (const [key, val] of Object.entries(p)) {
          if (key.toLowerCase() === lower && val) return String(val);
        }
      }
      return undefined;
    };
    return {
      serie: lookup("Serie", "serie", "Series"),
      categorie: lookup("Categorie", "Category", "categorie"),
      afmetingen: lookup("Afmetingen", "Afmeting", "Maten", "Maat", "Size", "Dimensions"),
      materiaal: lookup("Materiaal", "Material", "materiaal"),
      stoffering: lookup("Stoffering", "Bekleding", "stoffering"),
      kleur: lookup("Kleur", "Color", "Colour", "kleur"),
      patroon: lookup("Patroon", "Pattern", "patroon"),
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

// Bepaal welk badge te tonen (als er al eentje is)
function getBadge(product: Product): string | null {
  if (product.stock === 0) return "Uitverkocht";
  if (!product.createdAt) {
    return product.featured ? "Uitgelicht" : null;
  }
  const created = typeof product.createdAt === "string" ? new Date(product.createdAt) : product.createdAt;
  const daysSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 30) return "Nieuw";
  if (product.featured) return "Uitgelicht";
  return null;
}

export default function ProductCard({ product, variants }: Props) {
  const urls = imageUrls(product.images);
  const firstRaw = urls[0] ?? "";
  const secondRaw = urls[1];

  // Bron-foto's zijn native 1:1 (gen_fill bake). Geen runtime crop nodig,
  // alleen resize voor delivery.
  const first = firstRaw ? cldOptimize(firstRaw, { w: 800 }) : "";
  const second = secondRaw ? cldOptimize(secondRaw, { w: 800 }) : null;

  const badge = getBadge(product);
  const isOutOfStock = product.stock === 0;

  // Toon variant-naam zonder de kleur-suffix als er varianten zijn,
  // anders volledige naam.
  const displayName = variants && variants.length > 1 && product.colorName
    ? product.name.replace(new RegExp(`\\s*${product.colorName}$`, "i"), "")
    : product.name;

  return (
    <article data-hover-card className="product-card group">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-white mb-5 rounded-xl ring-1 ring-line/70 transition-all duration-500 group-hover:ring-line group-hover:shadow-[0_20px_40px_-20px_rgba(28,28,28,0.18)]">
          {first && (
            <Image
              src={first}
              alt={product.name}
              fill
              loading="lazy"
              className={`object-cover transition-all duration-700 ease-out card-img-primary group-hover:scale-[1.03] ${second ? "has-alt" : ""}`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}
          {second && (
            <Image
              src={second}
              alt=""
              fill
              loading="lazy"
              className="object-cover card-img-alt transition-all duration-700 ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}

          {/* Badge linksboven */}
          {badge && (
            <div className="absolute top-3 left-3 z-10">
              <span
                className={`inline-block text-[10px] uppercase tracking-[0.25em] px-2.5 py-1 backdrop-blur-sm font-medium rounded-full ${
                  isOutOfStock
                    ? "border border-stone/30 bg-white/90 text-stone"
                    : "border border-bronze/30 bg-white/90 text-ink"
                }`}
              >
                {badge}
              </span>
            </div>
          )}

          {/* Uitverkocht overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-white/55 z-[5] pointer-events-none rounded-xl" />
          )}

          {/* Subtle gradient onderkant voor diepte */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/[0.04] to-transparent pointer-events-none rounded-b-xl" />
        </div>

        {(() => {
          const s = parseSpecs(product.specs);
          // Eyebrow: serie naam, fallback naar categorie
          const eyebrow = s.serie ?? product.category;
          // Title: subType + afmeting, bv "Eettafel 200×90×75"
          const titleParts = [s.categorie ?? displayName];
          if (s.afmetingen) titleParts.push(s.afmetingen);
          const title = s.categorie ? titleParts.join(" · ") : displayName;
          // Subtitle: materiaal/stoffering + patroon + kleur (gefilterd op dubbels)
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
            <div className="space-y-1.5">
              {/* Eyebrow */}
              <p className="text-[10px] text-stone uppercase tracking-[0.25em]">
                {eyebrow}
              </p>
              {/* Hoofdnaam */}
              <h3 className="card-name font-serif text-base sm:text-lg text-ink leading-tight transition-colors duration-300">
                {title}
              </h3>
              {/* Materiaal + kleur */}
              {subtitle && (
                <p className="text-xs text-stone leading-snug">{subtitle}</p>
              )}
              {/* Prijs + voorraad */}
              <div className="flex items-baseline justify-between gap-3 pt-2">
                <p className="font-serif text-base sm:text-lg text-ink whitespace-nowrap tabular-nums">
                  &euro;{product.price.toFixed(0)},-
                </p>
                {!isOutOfStock ? (
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-stone">
                    <span className="w-1.5 h-1.5 rounded-full bg-bronze" />
                    Op voorraad
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-stone/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone/40" />
                    Uitverkocht
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </Link>

      {variants && variants.length > 1 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {variants.map((v) => {
              const isCurrent = v.slug === product.slug;
              return (
                <Link
                  key={v.slug}
                  href={`/products/${v.slug}`}
                  title={v.colorName ?? ""}
                  aria-label={v.colorName ?? "Variant"}
                  className={`block w-4 h-4 rounded-full border transition-all ${
                    isCurrent
                      ? "border-ink scale-110"
                      : "border-line hover:border-bronze hover:scale-110"
                  }`}
                  style={{ backgroundColor: v.colorHex ?? "#CFCFCF" }}
                />
              );
            })}
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone">
            {variants.length} kleuren
          </span>
        </div>
      )}
    </article>
  );
}
