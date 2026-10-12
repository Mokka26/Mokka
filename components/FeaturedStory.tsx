import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { firstImageUrl } from "@/lib/imageHelpers";
import { getCategory, productUrl } from "@/lib/categories";
import { cldOptimize, cloudinaryLoader } from "@/lib/cloudinary-url";
import { shippingInfo } from "@/lib/shipping-info";
import { Price } from "@/components/ui/price";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  listPrice?: number | null;
  category: string;
  images: string;
  stock: number;
  deliveryTime: string | null;
}

function deliveryLabel(product: Product): string {
  if (product.deliveryTime) return product.deliveryTime;
  return product.stock > 0
    ? shippingInfo.deliveryTime.inStock
    : shippingInfo.deliveryTime.backorder;
}

// Server component. Beeld via cloudinaryLoader (echte srcSet), levertijd uit
// het product of uit lib/shipping-info — nooit hardcoded.
export default function FeaturedStory({ product }: { product: Product | null }) {
  if (!product) return null;

  const mainImage = firstImageUrl(product.images);
  if (!mainImage) return null;

  // 4:3 met c_pad/b_auto: de bank blijft volledig in beeld (geen portrait-crop
  // van een liggende bronfoto).
  const src = cldOptimize(mainImage, { ar: "4:3", w: 1400, mode: "contain" });
  const href = productUrl(product);
  const categoryLabel = getCategory(product.category)?.label ?? product.category;
  const inStock = product.stock > 0;

  return (
    <section className="py-20 lg:py-32 bg-ink text-white overflow-hidden" aria-labelledby="spotlight-heading">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Beeld */}
          <div className="lg:col-span-7 lg:order-2">
            <Link
              href={href}
              className="group block relative rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-bone rounded-[10px]">
                <Image
                  src={src}
                  loader={cloudinaryLoader}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
                />
              </div>
            </Link>
          </div>

          {/* Tekst */}
          <div className="lg:col-span-5 lg:order-1">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-accent-light mb-5">
              In de spotlight
            </p>
            <p className="text-sm text-white/70 mb-3">{categoryLabel}</p>
            <h2
              id="spotlight-heading"
              className="font-serif text-white text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.02] tracking-[-0.03em] mb-6"
            >
              {product.name}
            </h2>

            <p className="text-white/80 text-base lg:text-lg leading-[1.7] mb-8 max-w-[55ch] line-clamp-5">
              {product.description}
            </p>

            <dl className="flex flex-wrap gap-x-10 gap-y-5 mb-10">
              <div>
                <dt className="text-sm text-white/70 mb-1">Prijs</dt>
                <dd>
                  <Price
                    value={product.price}
                    listPrice={product.listPrice ?? null}
                    vat
                    className="font-serif text-3xl text-white tabular-nums"
                    vatClassName="text-sm text-white/70 mt-1"
                  />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-white/70 mb-1">Levertijd</dt>
                <dd className="font-serif text-xl text-white">{deliveryLabel(product)}</dd>
              </div>
              <div>
                <dt className="text-sm text-white/70 mb-1">Voorraad</dt>
                <dd className="font-serif text-xl text-white">
                  {inStock ? "Op voorraad" : "Op bestelling"}
                </dd>
              </div>
            </dl>

            <Link
              href={href}
              className="group inline-flex items-center gap-3 bg-white text-ink px-7 py-4 rounded-[10px] text-sm font-medium uppercase tracking-[0.08em] hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white transition-colors"
            >
              Bekijk dit product
              <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
