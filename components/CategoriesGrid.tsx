"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

const primaries = [
  {
    name: "Banken",
    slug: "banken",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1800&q=95&auto=format&fit=crop",
    tagline: "Het hart van elke woonkamer",
    badge: "Signatuur",
  },
  {
    name: "Eettafels",
    slug: "eettafels",
    image: "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=1800&q=95&auto=format&fit=crop",
    tagline: "Waar avonden lang worden",
    badge: "Voorjaar",
  },
];

const secondary = [
  { name: "Hoekbanken", slug: "hoekbanken", image: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=1000&q=95&auto=format&fit=crop" },
  { name: "Stoelen", slug: "stoelen", image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=1000&q=95&auto=format&fit=crop" },
  { name: "Verlichting", slug: "verlichting", image: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=1000&q=95&auto=format&fit=crop" },
  { name: "Spiegels", slug: "spiegels", image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1000&q=95&auto=format&fit=crop" },
];

function PrimaryTile({ cat, delay, fmtCount }: { cat: typeof primaries[number]; delay: number; fmtCount: (s: string) => string }) {
  const { ref, style } = useReveal<HTMLDivElement>({ delay, distance: 30 });
  return (
    <div ref={ref} style={style}>
      <Link href={`/products?category=${cat.slug}`} className="group block h-full">
        <div className="relative aspect-[4/5] lg:aspect-[5/6] overflow-hidden bg-bone rounded-[10px] transition-all duration-500 group-hover:shadow-[0_30px_60px_-20px_rgba(20,17,13,0.25)]">
          <Image
            src={cat.image}
            alt={cat.name}
            fill
            className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.05]"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/15 to-transparent" />

          <div className="absolute top-6 left-6 flex items-center gap-2 bg-paper/95 backdrop-blur-sm px-3 py-1.5">
            <span className="w-1.5 h-1.5 bg-accent" />
            <span className="eyebrow text-ink">{cat.badge}</span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-7 lg:p-12 flex items-end justify-between gap-6">
            <div className="min-w-0">
              <p className="text-white/75 eyebrow mb-3 tabular-nums">
                {fmtCount(cat.slug)} · {cat.tagline}
              </p>
              <h3 className="font-serif text-white text-4xl sm:text-5xl lg:text-6xl leading-[0.95] tracking-[-0.035em]" style={{ fontVariationSettings: '"opsz" 144' }}>
                {cat.name}
              </h3>
            </div>
            <span className="w-12 h-12 lg:w-14 lg:h-14 bg-paper text-ink flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-paper transition-all duration-[480ms]" style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
              <ArrowUpRight className="w-5 h-5" strokeWidth={1.5} />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

function SecondaryTile({ cat, delay, fmtCount }: { cat: typeof secondary[number]; delay: number; fmtCount: (s: string) => string }) {
  const { ref, style } = useReveal<HTMLDivElement>({ delay, distance: 30 });
  return (
    <div ref={ref} style={style}>
      <Link href={`/products?category=${cat.slug}`} className="group block h-full">
        <div className="relative aspect-square overflow-hidden bg-bone rounded-[10px] transition-all duration-500 group-hover:shadow-[0_20px_40px_-20px_rgba(20,17,13,0.2)]">
          <Image
            src={cat.image}
            alt={cat.name}
            fill
            className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.05]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/65 via-ink/10 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white/70 eyebrow mb-1 tabular-nums">
                {fmtCount(cat.slug)}
              </p>
              <h3 className="font-serif text-white text-xl sm:text-2xl lg:text-3xl leading-tight tracking-[-0.025em]">
                {cat.name}
              </h3>
            </div>
            <ArrowUpRight
              className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0"
              strokeWidth={1.5}
            />
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function CategoriesGrid() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const { ref: headerRef, style: headerStyle } = useReveal<HTMLDivElement>({ distance: 20 });

  useEffect(() => {
    fetch("/api/products/counts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCounts(d.counts ?? {}))
      .catch(() => null);
  }, []);

  const fmtCount = (slug: string) => {
    const n = counts[slug];
    return n ? `${n} stuks` : "—";
  };

  return (
    <section className="py-24 lg:py-40 bg-white">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div
          ref={headerRef}
          style={headerStyle}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end mb-14 lg:mb-20"
        >
          <div className="lg:col-span-8">
            <p className="eyebrow text-accent mb-5">— Onze wereld</p>
            <h2 className="display-md text-ink">
              Shop per <span className="italic text-accent">categorie</span>
            </h2>
          </div>
          <div className="lg:col-span-4 flex lg:justify-end">
            <Link href="/products" className="btn-link">
              Alle producten
              <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-4 lg:mb-5">
          {primaries.map((cat, i) => (
            <PrimaryTile key={cat.slug} cat={cat} delay={i * 80} fmtCount={fmtCount} />
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {secondary.map((cat, i) => (
            <SecondaryTile key={cat.slug} cat={cat} delay={180 + i * 60} fmtCount={fmtCount} />
          ))}
        </div>
      </div>
    </section>
  );
}
