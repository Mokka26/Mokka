"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const primaries = [
  {
    name: "Banken",
    slug: "banken",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1600&q=95",
    count: 42,
    tagline: "Het hart van elke woonkamer",
    badge: "Signatuur",
  },
  {
    name: "Bedden",
    slug: "bedden",
    image: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1600&q=95",
    count: 25,
    tagline: "Slapen als ritueel",
    badge: "Nieuw",
  },
];

const secondary = [
  { name: "Tafels", slug: "tafels", image: "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=900&q=95", count: 18 },
  { name: "Stoelen", slug: "stoelen", image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=900&q=95", count: 24 },
  { name: "Slaapkamers", slug: "slaapkamers", image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=95", count: 15 },
  { name: "Kasten", slug: "kasten", image: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=900&q=95", count: 12 },
];

export default function CategoriesGrid() {
  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="flex items-end justify-between mb-10 lg:mb-14"
        >
          <div>
            <p className="eyebrow mb-3">Onze wereld</p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1]">
              Shop per <span className="italic">categorie</span>
            </h2>
          </div>
          <Link href="/products" className="hidden sm:inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink border-b border-ink pb-1 hover:gap-3 transition-all">
            Alle producten
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
            </svg>
          </Link>
        </motion.div>

        {/* TOP — 2 hero tiles (Banken + Bedden), equal weight */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 mb-3 lg:mb-4">
          {primaries.map((cat, i) => (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: i * 0.08 }}
            >
              <Link href={`/products?category=${cat.slug}`} className="group block h-full">
                <div className="relative aspect-[4/5] lg:aspect-[5/6] overflow-hidden bg-bone">
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.04]"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />

                  {/* Badge top-left */}
                  <div className="absolute top-6 left-6 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-bronze" />
                    <span className="text-ink text-[10px] uppercase tracking-[0.3em]">{cat.badge}</span>
                  </div>

                  {/* Content bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10 flex items-end justify-between gap-6">
                    <div>
                      <p className="text-white/60 text-[10px] uppercase tracking-[0.3em] mb-2">
                        {cat.count} stuks · {cat.tagline}
                      </p>
                      <h3 className="font-serif text-white text-4xl sm:text-5xl lg:text-6xl leading-[0.95]">
                        {cat.name}
                      </h3>
                    </div>
                    <span className="w-12 h-12 lg:w-14 lg:h-14 bg-white text-ink flex items-center justify-center flex-shrink-0 group-hover:bg-bronze group-hover:text-white transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* BOTTOM — 4 secondary tiles in een rij */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {secondary.map((cat, i) => (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.16 + i * 0.06 }}
            >
              <Link href={`/products?category=${cat.slug}`} className="group block h-full">
                <div className="relative aspect-square overflow-hidden bg-bone">
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.04]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-ink/15 group-hover:bg-ink/30 transition-colors duration-700" />

                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-white/60 text-[9px] sm:text-[10px] uppercase tracking-[0.3em] mb-0.5">
                        {cat.count} stuks
                      </p>
                      <h3 className="font-serif text-white text-xl sm:text-2xl lg:text-3xl leading-none">
                        {cat.name}
                      </h3>
                    </div>
                    <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                    </svg>
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
