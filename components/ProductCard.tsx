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
}

interface Props {
  product: Product;
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

export default function ProductCard({ product }: Props) {
  const urls = imageUrls(product.images);
  const firstRaw = urls[0] ?? "";
  const secondRaw = urls[1];

  // Bron-foto's zijn native 1:1 (gen_fill bake). Geen runtime crop nodig,
  // alleen resize voor delivery.
  const first = firstRaw ? cldOptimize(firstRaw, { w: 800 }) : "";
  const second = secondRaw ? cldOptimize(secondRaw, { w: 800 }) : null;

  const badge = getBadge(product);
  const isOutOfStock = product.stock === 0;

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <article data-hover-card className="product-card">
        <div className="relative aspect-square overflow-hidden bg-white mb-5">
          {first && (
            <Image
              src={first}
              alt={product.name}
              fill
              loading="lazy"
              className={`object-cover transition-opacity duration-700 ease-out card-img-primary ${second ? "has-alt" : ""}`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}
          {second && (
            <Image
              src={second}
              alt=""
              fill
              loading="lazy"
              className="object-cover card-img-alt transition-opacity duration-700 ease-out"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}

          {/* Badge linksboven — Uitverkocht / Nieuw / Uitgelicht */}
          {badge && (
            <div className="absolute top-3 left-3 z-10">
              <span
                className={`inline-block text-[10px] uppercase tracking-[0.25em] px-2.5 py-1 backdrop-blur-sm font-medium ${
                  isOutOfStock
                    ? "border border-stone/40 bg-white/90 text-stone"
                    : "border border-bronze/30 bg-white/85 text-ink"
                }`}
              >
                {badge}
              </span>
            </div>
          )}

          {/* Uitverkocht overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-white/55 z-[5] pointer-events-none" />
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
