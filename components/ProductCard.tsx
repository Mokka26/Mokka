import Link from "next/link";
import Image from "next/image";
import { cldOptimize, cloudinaryLoader } from "@/lib/cloudinary-url";
import { parseImages } from "@/lib/imageHelpers";
import { getCategory, productUrl } from "@/lib/categories";
import { shippingInfo } from "@/lib/shipping-info";
import { Price } from "@/components/ui/price";
import { StockBadge } from "@/components/ui/StockBadge";
import { ASPECT_AR, CARD_ASPECT_CLASS, orientationOf } from "@/components/product/imageAspect";
import { DIMENSION_KEYS, findSpec, isNewProduct, parseSizeVariants, parseSpecs } from "@/components/product/specs";

/**
 * Productkaart — server-vriendelijk (geen hooks, geen event handlers; hover
 * puur via CSS). Wordt gebruikt in CategoryListing, ProductsContent,
 * CollectionPreview, RecentlyViewed en op de PDP (gerelateerd / past goed bij).
 */
export interface ProductCardProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  listPrice?: number | null;
  category: string;
  images: string;
  featured?: boolean;
  createdAt?: Date | string;
  stock?: number;
  deliveryTime?: string | null;
  sizeVariants?: string | null;
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  specs?: string | null;
}

export type ProductCardVariant = {
  slug: string;
  colorName: string | null;
  colorHex: string | null;
};

interface Props {
  product: ProductCardProduct;
  variants?: ProductCardVariant[];
  /** Eerste card op een listing → priority + eager loading voor LCP */
  priority?: boolean;
  /**
   * @deprecated De tegelverhouding volgt nu de echte foto (w/h uit het
   * images-JSON). De prop blijft bestaan zodat bestaande aanroepen werken.
   */
  wide?: boolean;
}

export default function ProductCard({ product, variants, priority = false, wide = false }: Props) {
  const parsed = parseImages(product.images);
  const firstImage = parsed[0];
  const firstRaw = firstImage?.url ?? "";

  // Tegelverhouding uit de echte foto: liggend → 4:3 (cover, gecentreerd —
  // liggende bron laat dan niets wezenlijks weg), staand → 4:5 (contain op
  // bone), vierkant → 1:1. `wide` dwingt 4:3 af voor oude aanroepen zonder
  // dimensies in de data.
  const orientation = wide && (!firstImage?.w || !firstImage?.h) ? "landscape" : orientationOf(firstImage);
  const isContain = orientation === "portrait";
  const aspectClass = CARD_ASPECT_CLASS[orientation];
  // w:1000 is de basis; de cloudinaryLoader overschrijft 'm per srcSet-breedte,
  // zodat mobiel niet onnodig een 1000px-foto laadt.
  const first = firstRaw
    ? cldOptimize(firstRaw, {
        ...(isContain ? {} : { ar: ASPECT_AR[orientation], mode: "fill" as const }),
        w: 1000,
        upscale: true,
        sourceW: firstImage?.w,
        quality: "auto:good",
      })
    : "";

  // <= 0 (niet === 0): een race kon voorheen negatieve voorraad geven; die moet
  // als uitverkocht tonen. Ontbrekende stock (niet geselecteerd) = op voorraad.
  const isOutOfStock = (product.stock ?? 1) <= 0;

  // Specs één keer parsen (try/catch + type guard in parseSpecs).
  const specs = parseSpecs(product.specs);
  const serie = findSpec(specs, "Serie", "Series");
  const dimensions = findSpec(specs, ...DIMENSION_KEYS);
  const materiaal = findSpec(specs, "Materiaal", "Material");
  const stoffering = findSpec(specs, "Stoffering", "Bekleding");
  const patroon = findSpec(specs, "Patroon", "Pattern");

  // Titel = volledige productnaam (incl. kleur indien aanwezig).
  const title = product.name;

  // Korte categorie-regel onder de titel (bv. banken → "In diverse
  // uitvoeringen en kleuren."). Komt uit lib/categories.ts.
  const cardSubtitle = getCategory(product.category)?.cardSubtitle ?? null;

  // Eyebrow toont serie/collectie alleen als die niet al in de naam zit.
  const eyebrow = serie && !product.name.toLowerCase().includes(serie.toLowerCase()) ? serie : null;

  // Materiaal-regel: dedupe waardes die elkaar overlappen (bv "Stof" + "Stoffering")
  const materialParts: string[] = [];
  const addUnique = (val?: string) => {
    if (!val) return;
    const joined = materialParts.join(" ").toLowerCase();
    if (!joined.includes(val.toLowerCase())) materialParts.push(val);
  };
  addUnique(materiaal);
  addUnique(stoffering);
  addUnique(patroon);
  const materialLine = materialParts.join(" · ");

  // Maatvarianten → "vanaf" + laagste prijs.
  const sizeVariants = parseSizeVariants(product.sizeVariants);
  const variantPrices = sizeVariants.map((v) => v.price).filter((p): p is number => typeof p === "number" && p > 0);
  const hasSizeVariants = sizeVariants.length > 0;
  const displayPrice = hasSizeVariants && variantPrices.length > 0 ? Math.min(product.price > 0 ? product.price : Infinity, ...variantPrices) : product.price;

  // Badges: alleen bij feitelijke data (CLAUDE.md §11 — geen fake urgency).
  const isNew = isNewProduct(product.createdAt);
  // Adviesprijs hoort bij de basisprijs; bij "vanaf" (maatvarianten) tonen we
  // geen korting op kaartniveau — dat doet de PDP per maat.
  const listPrice = hasSizeVariants ? null : product.listPrice ?? null;
  const hasDiscount = listPrice != null && listPrice > displayPrice && displayPrice > 0;
  const discountPct = hasDiscount && listPrice ? Math.round(((listPrice - displayPrice) / listPrice) * 100) : 0;

  // Levertijd: productspecifiek of de standaard uit lib/shipping-info.
  const deliveryLine = isOutOfStock ? null : `Levertijd ${product.deliveryTime?.trim() || shippingInfo.deliveryTime.inStock}`;

  // Color swatches: max 4, rest als "+N"
  const colorDots = variants && variants.length > 1 ? variants.slice(0, 4) : [];
  const extraColors = variants && variants.length > 4 ? variants.length - 4 : 0;

  return (
    <article className="product-card group h-full">
      <Link href={productUrl(product)} className="flex flex-col h-full rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <figure className={`relative ${aspectClass} overflow-hidden bg-bone mb-3 sm:mb-4 rounded-[10px]`}>
          {first ? (
            <Image
              src={first}
              alt={firstImage?.alt ? `${product.name} — ${firstImage.alt}` : product.name}
              fill
              loader={cloudinaryLoader}
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              className={`${isContain ? "object-contain" : "object-cover object-center"} transition-transform duration-[480ms] ease-out motion-safe:group-hover:scale-[1.03]`}
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone">
              <span aria-hidden="true" className="w-8 h-px bg-accent" />
              <span className="text-[13px] uppercase tracking-[0.18em]">Foto volgt</span>
            </div>
          )}

          {(isNew || hasDiscount) && (
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-[5]">
              {hasDiscount && (
                <span className="bg-accent text-paper text-[13px] font-medium px-2.5 py-1 rounded-[6px] tabular-nums">
                  -{discountPct}%<span className="sr-only"> korting</span>
                </span>
              )}
              {isNew && (
                <span className="bg-ink text-paper text-[13px] font-medium px-2.5 py-1 rounded-[6px]">Nieuw</span>
              )}
            </div>
          )}

          {isOutOfStock && (
            <div className="absolute inset-0 bg-paper/45 z-[5] pointer-events-none" aria-hidden="true" />
          )}
        </figure>

        {/* Info block — flex-col zodat footer (prijs+voorraad) altijd op
            zelfde Y-positie eindigt ongeacht spec-grid lengte */}
        <div className="text-left flex flex-col flex-1">
          {eyebrow && (
            <p className="text-[13px] text-stone uppercase tracking-[0.14em] font-medium mb-1">{eyebrow}</p>
          )}

          <h3 className="font-serif text-lg sm:text-2xl text-ink leading-[1.2] sm:leading-[1.15] tracking-[-0.015em] mb-1.5 line-clamp-2 sm:line-clamp-none">
            <span className="card-name">{title}</span>
          </h3>

          {cardSubtitle && (
            <p className="text-[13px] text-stone leading-snug mb-2">{cardSubtitle}</p>
          )}

          {/* SIGNATURE: hairline-marker */}
          <div className="w-4 h-px bg-accent-light mb-2 sm:mb-3" aria-hidden="true" />

          {(dimensions || materialLine || colorDots.length > 0) && (
            <dl className="space-y-1 mb-3 text-[13px] sm:text-sm leading-[1.45]">
              {dimensions && (
                <div className="flex items-baseline gap-3">
                  <dt className="hidden sm:block text-[13px] uppercase tracking-[0.1em] text-stone w-[72px] shrink-0">Afmeting</dt>
                  <dd className="text-ink tabular-nums truncate" title={dimensions}>
                    <span className="sr-only sm:hidden">Afmeting: </span>
                    {dimensions}
                  </dd>
                </div>
              )}
              {materialLine && (
                <div className="flex items-baseline gap-3">
                  <dt className="hidden sm:block text-[13px] uppercase tracking-[0.1em] text-stone w-[72px] shrink-0">Materiaal</dt>
                  <dd className="text-stone sm:text-ink truncate" title={materialLine}>
                    <span className="sr-only sm:hidden">Materiaal: </span>
                    {materialLine}
                  </dd>
                </div>
              )}
              {colorDots.length > 0 && (
                <div className="flex items-center gap-3">
                  <dt className="hidden sm:block text-[13px] uppercase tracking-[0.1em] text-stone w-[72px] shrink-0">Kleuren</dt>
                  <dd className="flex items-center gap-1.5 pt-0.5">
                    <span className="sr-only">Verkrijgbaar in: </span>
                    {colorDots.map((v) => (
                      <span
                        key={v.slug}
                        title={v.colorName ?? undefined}
                        className={`inline-block w-4 h-4 rounded-full border border-line ${v.colorHex ? "" : "bg-stone/30"}`}
                        style={v.colorHex ? { backgroundColor: v.colorHex } : undefined}
                      >
                        {v.colorName && <span className="sr-only">{v.colorName}</span>}
                      </span>
                    ))}
                    {extraColors > 0 && (
                      <span className="text-[13px] text-stone ml-0.5">+{extraColors}<span className="sr-only"> kleuren</span></span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {/* Footer: prijs + voorraad — mt-auto duwt naar onder zodat alle
              cards in een grid-rij hun prijs op gelijke hoogte hebben */}
          <div className="flex flex-col gap-2 pt-2.5 sm:pt-3 border-t border-line/60 mt-auto">
            <div className="flex items-start justify-between gap-3">
              <Price price={displayPrice} listPrice={listPrice} vat from={hasSizeVariants} size="sm" />
              <StockBadge stock={product.stock} className="pt-1" />
            </div>
            {deliveryLine && <p className="text-[13px] text-stone leading-snug">{deliveryLine}</p>}
          </div>
        </div>
      </Link>
    </article>
  );
}
