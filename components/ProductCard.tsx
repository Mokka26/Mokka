"use client";

import Link from "next/link";
import Image from "next/image";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  images: string;
  featured?: boolean;
  createdAt?: Date | string;
}

interface Props {
  product: Product;
}

// Bepaal welk badge te tonen (als er al eentje is)
function getBadge(product: Product): string | null {
  if (!product.createdAt) {
    return product.featured ? "Uitgelicht" : null;
  }
  const created = typeof product.createdAt === "string" ? new Date(product.createdAt) : product.createdAt;
  const daysSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 30) return "Nieuw";
  if (product.featured) return "Uitgelicht";
  return null;
}

export default function ProductCard({ product }: Props) {
  const images: string[] = JSON.parse(product.images);
  const firstImage = images[0];
  const secondImage = images.length > 1 ? images[1] : null;
  const badge = getBadge(product);

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <article data-hover-card className="product-card">
        <div className="relative aspect-[4/5] overflow-hidden bg-bone mb-5">
          <Image
            src={firstImage}
            alt={product.name}
            fill
            loading="lazy"
            className={`object-cover transition-opacity duration-700 ease-out card-img-primary ${secondImage ? "has-alt" : ""}`}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
          />
          {secondImage && (
            <Image
              src={secondImage}
              alt=""
              fill
              loading="lazy"
              className="object-cover card-img-alt transition-opacity duration-700 ease-out"
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
            />
          )}

          {/* Badge linksboven — alleen voor Nieuw of Uitgelicht */}
          {badge && (
            <div className="absolute top-3 left-3 z-10">
              <span className="inline-block text-[10px] uppercase tracking-[0.25em] px-2.5 py-1 border border-bronze/30 bg-white/85 backdrop-blur-sm text-ink font-medium">
                {badge}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-stone uppercase tracking-[0.25em] mb-1.5">
              {product.category}
            </p>
            <h3 className="card-name font-serif text-base sm:text-lg text-ink leading-tight transition-colors duration-300">
              {product.name}
            </h3>
          </div>
          <p className="font-serif text-base sm:text-lg text-ink whitespace-nowrap">
            &euro;{product.price.toFixed(0)}
          </p>
        </div>
      </article>
    </Link>
  );
}
