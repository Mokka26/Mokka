"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

interface Banner {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  image: string;
  accent?: "bronze" | "ink";
}

const banners: Banner[] = [
  {
    eyebrow: "Sale",
    title: "Tot 30% korting",
    description: "Geselecteerde stukken uit de winter-collectie.",
    href: "/products?sort=price-asc",
    cta: "Bekijk aanbiedingen",
    image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=900&q=85",
    accent: "bronze",
  },
  {
    eyebrow: "Nieuw",
    title: "Voorjaar 2026",
    description: "Wabi-sabi banken in natuurlijke tinten.",
    href: "/products?category=banken",
    cta: "Ontdek de collectie",
    image: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=900&q=85",
  },
  {
    eyebrow: "Editorial",
    title: "De Eettafel-serie",
    description: "Steen, eiken en marmer — ambachtelijk samengesteld.",
    href: "/products?category=eettafels",
    cta: "Verken eettafels",
    image: "https://images.unsplash.com/photo-1615875605825-5eb9bb5d52ac?w=900&q=85",
    accent: "ink",
  },
];

export default function PromoBanners() {
  return (
    <section className="py-24 lg:py-32 bg-paper">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {banners.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <Link
                href={b.href}
                className="block group relative aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-line/70 transition-all duration-500 hover:ring-line hover:shadow-[0_30px_60px_-20px_rgba(28,28,28,0.25)]"
              >
                {/* Bg image */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.5s] ease-out group-hover:scale-[1.05]"
                  style={{ backgroundImage: `url(${b.image})` }}
                />
                {/* Gradient overlay voor leesbaarheid */}
                <div className={`absolute inset-0 ${
                  b.accent === "bronze"
                    ? "bg-gradient-to-t from-bronze/90 via-bronze/30 to-transparent"
                    : b.accent === "ink"
                    ? "bg-gradient-to-t from-ink/90 via-ink/40 to-transparent"
                    : "bg-gradient-to-t from-ink/80 via-ink/20 to-transparent"
                }`} />
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-10 text-white">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/80 mb-4">
                    {b.eyebrow}
                  </p>
                  <h3 className="font-serif text-2xl lg:text-3xl xl:text-4xl leading-tight mb-4">
                    {b.title}
                  </h3>
                  <p className="text-sm lg:text-base text-white/80 mb-7 max-w-xs leading-relaxed">
                    {b.description}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] group-hover:gap-3 transition-all">
                    <span className="border-b border-white/40 pb-1">{b.cta}</span>
                    <ArrowUpRight className="w-4 h-4 group-hover:rotate-12 transition-transform" strokeWidth={1.5} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
