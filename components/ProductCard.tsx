import Link from "next/link";
import { cldOptimize } from "@/lib/cloudinary-url";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { frameMode, parseImages } from "@/lib/imageHelpers";
import { getCategory, productUrl } from "@/lib/categories";
import { Price } from "@/components/ui/price";
import { StockBadge } from "@/components/ui/StockBadge";
import { deliveryLine } from "@/components/product/deliveryTime";
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

/** Default `sizes` voor een 2-koloms grid op mobiel, 3 kolommen op desktop. */
export const PRODUCT_CARD_SIZES = "(max-width: 768px) 50vw, 33vw";

interface Props {
  product: ProductCardProduct;
  variants?: ProductCardVariant[];
  /** Eerste card op een listing → priority + eager loading voor LCP */
  priority?: boolean;
  /**
   * `sizes`-attribuut van de foto; zet 'm per grid (bv. "(max-width: 768px) 50vw, 25vw"
   * bij vier kolommen). Default: PRODUCT_CARD_SIZES.
   */
  sizes?: string;
  /**
   * @deprecated Elke kaart heeft nu dezelfde vaste 4:3-beeldbox.
   * De prop blijft bestaan zodat bestaande aanroepen werken; hij doet niets.
   */
  wide?: boolean;
}

export default function ProductCard({ product, variants, priority = false, sizes = PRODUCT_CARD_SIZES }: Props) {
  const parsed = parseImages(product.images);
  const firstImage = parsed[0];
  const firstRaw = firstImage?.url ?? "";

  // Eén vaste beeldbox (4:3) voor élke kaart, zodat rijen in een grid gelijk
  // lopen (naam/prijs op gelijke hoogte).
  // w:1000 is de basis; de cloudinaryLoader overschrijft 'm per srcSet-breedte,
  // zodat mobiel niet onnodig een 1000px-foto laadt.
  // Cloudinary maakt de foto zélf 4:3, zodat de box altijd volledig gevuld is
  // (object-cover) zonder gekleurde band: vrijstaande foto's worden opgevuld in
  // hun eigen randkleur (c_pad + b_auto, onzichtbaar), sfeerfoto's worden slim
  // bijgesneden (c_fill + g_auto). Zie `bg` in lib/imageHelpers.ts.
  const first = firstRaw
    ? cldOptimize(firstRaw, {
        ar: "4:3",
        mode: frameMode(firstImage),
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
  const delivery = isOutOfStock ? null : deliveryLine(product.deliveryTime);

  // Color swatches: max 4, rest als "+N"
  const colorDots = variants && variants.length > 1 ? variants.slice(0, 4) : [];
  const extraColors = variants && variants.length > 4 ? variants.length - 4 : 0;

  return (
    <article className="product-card group h-full min-w-0">
      <Link href={productUrl(product)} className="flex flex-col h-full min-w-0 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <figure className="relative aspect-[4/3] overflow-hidden bg-bone mb-3 sm:mb-4 rounded-[10px]">
          {first ? (
            <CloudinaryImage
              src={first}
              alt={firstImage?.alt ? `${product.name} — ${firstImage.alt}` : product.name}
              fill
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              className="object-cover transition-transform duration-[480ms] ease-out motion-safe:group-hover:scale-[1.03]"
              sizes={sizes}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone">
              <span aria-hidden="true" className="w-8 h-px bg-accent" />
              <span className="eyebrow-lg">Foto volgt</span>
            </div>
          )}

          {(isNew || hasDiscount) && (
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-[5]">
              {hasDiscount && (
                <span className="badge bg-accent tabular-nums">
                  -{discountPct}%<span className="sr-only"> korting</span>
                </span>
              )}
              {isNew && (
                <span className="badge">Nieuw</span>
              )}
            </div>
          )}

          {isOutOfStock && (
            <div className="absolute inset-0 bg-paper/45 z-[5] pointer-events-none" aria-hidden="true" />
          )}
        </figure>

        {/* Info block — flex-col zodat footer (prijs+voorraad) altijd op
            zelfde Y-positie eindigt ongeacht spec-grid lengte */}
        <div className="text-left flex flex-col flex-1 min-w-0">
          {eyebrow && (
            <p className="eyebrow-lg mb-1">{eyebrow}</p>
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
                  <dt className="hidden sm:block eyebrow-lg tracking-[0.08em] w-[72px] shrink-0">Afmeting</dt>
                  <dd className="text-ink tabular-nums truncate" title={dimensions}>
                    <span className="sr-only sm:hidden">Afmeting: </span>
                    {dimensions}
                  </dd>
                </div>
              )}
              {materialLine && (
                <div className="flex items-baseline gap-3">
                  <dt className="hidden sm:block eyebrow-lg tracking-[0.08em] w-[72px] shrink-0">Materiaal</dt>
                  <dd className="text-stone sm:text-ink truncate" title={materialLine}>
                    <span className="sr-only sm:hidden">Materiaal: </span>
                    {materialLine}
                  </dd>
                </div>
              )}
              {colorDots.length > 0 && (
                <div className="flex items-center gap-3">
                  <dt className="hidden sm:block eyebrow-lg tracking-[0.08em] w-[72px] shrink-0">Kleuren</dt>
                  <dd className="flex items-center gap-1.5 pt-0.5">
                    <span className="sr-only">Verkrijgbaar in: </span>
                    {colorDots.map((v) => (
                      <span
                        key={v.slug}
                        title={v.colorName ?? undefined}
                        className={`inline-block w-4 h-4 rounded-full border border-line ${v.colorHex ? "" : "bg-mist"}`}
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
              cards in een grid-rij hun prijs op gelijke hoogte hebben.
              Op mobiel (2 kolommen) gestapeld: prijs, daaronder voorraad;
              vanaf sm naast elkaar. Kortingspercentage staat al als badge op
              de foto, dus bij de prijs alleen de doorgestreepte adviesprijs. */}
          <div className="flex flex-col gap-1.5 pt-2.5 sm:pt-3 border-t border-line mt-auto min-w-0">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <Price price={displayPrice} listPrice={listPrice} vat from={hasSizeVariants} size="sm" showSavings={false} />
              <StockBadge stock={product.stock} className="sm:pt-1" />
            </div>
            {delivery && <p className="text-[13px] text-stone leading-snug">{delivery}</p>}
          </div>
        </div>
      </Link>
    </article>
  );
}
