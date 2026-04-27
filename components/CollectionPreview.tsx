"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import ProductCard from "./ProductCard";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string;
  images: string;
}

export default function CollectionPreview({ products }: { products: Product[] }) {
  return (
    <section className="py-24 lg:py-32 bg-paper">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        {/* Header — subtiel, editorial */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="flex items-end justify-between mb-10 lg:mb-14"
        >
          <div>
            <p className="text-stone text-[11px] uppercase tracking-[0.3em] mb-3">Nieuwe collectie</p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1]">
              Voorjaar 2026
            </h2>
          </div>
          <Link href="/products" className="hidden sm:inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink border-b border-ink pb-1 hover:gap-3 transition-all">
            Bekijk alles
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
            </svg>
          </Link>
        </motion.div>

        {/* Clean 4-kolom grid — laat de producten spreken */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {products.slice(0, 8).map((product) => (
            <motion.div
              key={product.id}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] } },
              }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </motion.div>

        {/* Mobile CTA */}
        <div className="sm:hidden mt-10 text-center">
          <Link href="/products" className="btn-ghost">Bekijk alles</Link>
        </div>
      </div>
    </section>
  );
}
