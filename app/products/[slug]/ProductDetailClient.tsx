"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard from "@/components/ProductCard";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string;
  featured: boolean;
}

interface Props {
  product: Product;
  relatedProducts: Product[];
}

const usps = [
  { icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", label: "Gratis verzending", sub: "Boven €100" },
  { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", label: "2 jaar garantie", sub: "Op alle producten" },
  { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", label: "30 dagen retour", sub: "Gratis retourneren" },
];

export default function ProductDetailClient({ product, relatedProducts }: Props) {
  const images: string[] = JSON.parse(product.images);
  const [selectedImage, setSelectedImage] = useState(0);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart({ id: product.id, name: product.name, price: product.price, images: product.images, category: product.category });
    }
    toast.success(`${product.name} toegevoegd aan winkelwagen`, {
      description: `Aantal: ${quantity}`,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="pt-28 sm:pt-32 pb-20">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-8">
        <nav className="text-[11px] text-stone uppercase tracking-[0.15em]">
          <Link href="/" className="hover:text-bronze transition-colors">Home</Link>
          <span className="mx-2 text-bone">/</span>
          <Link href="/products" className="hover:text-bronze transition-colors">Producten</Link>
          <span className="mx-2 text-bone">/</span>
          <Link href={`/products?category=${product.category}`} className="hover:text-bronze transition-colors capitalize">{product.category}</Link>
          <span className="mx-2 text-bone">/</span>
          <span className="text-ink">{product.name}</span>
        </nav>
      </div>

      {/* Product — twee kolommen */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Afbeeldingen */}
          <div>
            {/* Hoofd afbeelding */}
            <div className="relative aspect-square bg-bone overflow-hidden mb-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0"
                >
                  <Image
                    src={images[selectedImage]}
                    alt={product.name}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Thumbnails — horizontaal scrollbaar */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: "none" }}>
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 overflow-hidden transition-all duration-200 ${
                      selectedImage === i ? "ring-2 ring-bronze" : "opacity-40 hover:opacity-70"
                    }`}
                  >
                    <Image src={img} alt="" fill loading="lazy" className="object-cover" sizes="80px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center py-4 lg:py-8">
            <p className="text-stone text-[11px] uppercase tracking-[0.3em] mb-2">{product.category}</p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-ink mb-3 leading-tight">{product.name}</h1>
            <p className="text-xl sm:text-2xl text-bronze font-light mb-6">&euro;{product.price.toFixed(2)}</p>

            <div className="w-8 h-[1px] bg-bone mb-6" />

            <p className="text-stone leading-[1.8] text-sm sm:text-base mb-8">{product.description}</p>

            {/* Aantal + Knop */}
            <div className="flex gap-3 mb-6">
              <div className="flex items-center border border-line">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 sm:px-4 py-3 text-stone hover:text-bronze transition-colors text-sm">-</button>
                <span className="px-2 sm:px-3 py-3 text-ink text-sm min-w-[2.5rem] text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="px-3 sm:px-4 py-3 text-stone hover:text-bronze transition-colors text-sm">+</button>
              </div>
              <motion.button
                onClick={handleAddToCart}
                className={`btn-primary flex-1 text-center ${added ? "!bg-success" : ""}`}
                whileTap={{ scale: 0.98 }}
              >
                {added ? "Toegevoegd!" : "In Winkelwagen"}
              </motion.button>
            </div>

            {/* USP's */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6 border-t border-line">
              {usps.map((usp) => (
                <div key={usp.label} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-bronze flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={usp.icon} />
                  </svg>
                  <span className="text-stone text-[11px]">{usp.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gerelateerd */}
      {relatedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mt-20 pt-16 border-t border-line">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="eyebrow">Meer uit deze collectie</p>
              <h2 className="text-xl sm:text-2xl font-serif text-ink">Gerelateerde Producten</h2>
            </div>
            <Link href={`/products?category=${product.category}`} className="hidden sm:inline-flex items-center gap-2 text-xs text-ink hover:text-bronze transition-colors uppercase tracking-[0.15em] font-medium group">
              Alles bekijken
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
