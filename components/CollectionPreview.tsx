import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard from "./ProductCard";

interface Product {
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
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  specs?: string | null;
}

interface Props {
  products: Product[];
  /** "Uitgelicht" (featured) of "Nieuw binnen" (nieuwste) — bepaald in app/page.tsx. */
  title: string;
  eyebrow: string;
}

// Server component: de kaarten staan direct in de server-HTML (geen reveal
// met opacity 0). ProductCard zelf is een client component (hover/parallax).
export default function CollectionPreview({ products, title, eyebrow }: Props) {
  if (products.length === 0) return null;

  return (
    <section className="py-20 lg:py-32 bg-paper" aria-labelledby="collection-heading">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end mb-12 lg:mb-16">
          <div className="lg:col-span-8">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-accent-dark mb-4">
              {eyebrow}
            </p>
            <h2 id="collection-heading" className="display-md text-ink">
              {title}
            </h2>
          </div>
          <div className="lg:col-span-4 hidden sm:flex lg:justify-end">
            <Link href="/products" className="btn-link text-sm">
              Bekijk alles
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16">
          {products.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} sizes="(max-width: 768px) 50vw, 25vw" />
          ))}
        </div>

        <div className="sm:hidden mt-10 text-center">
          <Link href="/products" className="btn-ghost text-sm">
            Bekijk alles
          </Link>
        </div>
      </div>
    </section>
  );
}
