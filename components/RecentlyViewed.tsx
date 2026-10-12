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

// Client component (localStorage). Onder de fold: geen priority op de kaarten.
// Zodra er slugs bekend zijn, reserveert de sectie direct hoogte zodat de
// pagina niet verspringt als de producten binnenkomen.
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 min-h-[22rem] sm:min-h-[26rem]">
          {state.status === "ready" &&
            state.products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}
