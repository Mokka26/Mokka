"use client";

import { useEffect, useState } from "react";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import ProductCard from "@/components/ProductCard";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  listPrice?: number | null;
  category: string;
  images: string;
  stock?: number;
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  specs?: string | null;
}

interface Props {
  currentSlug?: string;
  max?: number;
}

type State =
  | { status: "loading" }
  | { status: "ready"; products: Product[] };

// Vier kolommen vanaf lg, twee daaronder.
const CARD_SIZES = "(max-width: 768px) 50vw, 25vw";

// Client component (localStorage via useSyncExternalStore: server en eerste
// client-render geven dezelfde lege lijst, dus geen hydration-mismatch).
// Zonder slugs rendert dit niets — geen lege sectie, geen gereserveerde
// ruimte. Zijn er wél slugs, dan staat er per verwachte kaart direct een
// skeleton in dezelfde grid, zodat de footer niet verspringt (CLS) zodra de
// producten binnenkomen. Onder de fold: geen priority op de kaarten.
export default function RecentlyViewed({ currentSlug, max = 4 }: Props) {
  const slugs = useRecentlyViewed(currentSlug);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (slugs.length === 0) return;
    const ctrl = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/products/by-slugs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs: slugs.slice(0, max) }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setState({ status: "ready", products: [] });
          return;
        }
        const data = (await res.json()) as { products?: unknown };
        setState({
          status: "ready",
          products: Array.isArray(data.products) ? (data.products as Product[]) : [],
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ status: "ready", products: [] });
      }
    }

    void load();
    return () => ctrl.abort();
  }, [slugs, max]);

  if (slugs.length === 0) return null;
  if (state.status === "ready" && state.products.length === 0) return null;

  const expected = Math.min(slugs.length, max);

  return (
    <section
      className="bg-paper py-16 lg:py-24 border-t border-line"
      aria-labelledby="recently-viewed-heading"
      aria-busy={state.status === "loading"}
    >
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-stone mb-3">Voor jou</p>
          <h2 id="recently-viewed-heading" className="font-serif text-2xl sm:text-3xl lg:text-4xl text-ink">
            Recent bekeken
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {state.status === "ready"
            ? state.products.map((p) => <ProductCard key={p.id} product={p} sizes={CARD_SIZES} />)
            : Array.from({ length: expected }, (_, i) => (
                // Skeleton in de maat van een kaart: foto (1:1, het midden van
                // de 4:3/4:5-tegels) + titel + prijsregel.
                <div key={i} className="space-y-3" aria-hidden="true">
                  <div className="aspect-square rounded-[10px] bg-bone animate-shimmer" />
                  <div className="h-5 w-3/4 bg-bone animate-shimmer" />
                  <div className="h-4 w-1/3 bg-bone animate-shimmer" />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
