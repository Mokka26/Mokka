"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: Props) {
  const { items, totalItems, totalPrice, removeFromCart, updateQuantity } = useCart();
  const shipping = totalPrice >= 100 ? 0 : 9.95;
  const total = totalPrice + shipping;

  // Lock scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/30 backdrop-blur-[2px] z-[90]"
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white border-l border-line z-[100] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 lg:px-8 py-6 border-b border-line">
              <div className="flex items-center gap-3">
                <span id="cart-drawer-title" className="eyebrow">
                  Winkelwagen {totalItems > 0 && `(${totalItems})`}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-ink hover:text-bronze transition-colors p-1"
                aria-label="Sluiten"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Content */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="w-16 h-16 border border-line rounded-full flex items-center justify-center mb-8">
                  <ShoppingBag className="w-6 h-6 text-stone" strokeWidth={1.5} />
                </div>
                <p className="eyebrow mb-4">Leeg</p>
                <h3 className="font-serif text-2xl text-ink mb-3">Je winkelwagen is leeg</h3>
                <p className="text-slate text-sm mb-10 max-w-xs">
                  Ontdek onze collectie en voeg je favorieten toe.
                </p>
                <button onClick={onClose} className="btn-ghost">
                  Verder winkelen
                </button>
              </div>
            ) : (
              <>
                {/* Items — scrollable */}
                <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
                  <ul className="space-y-6">
                    {items.map((item) => {
                      const images: string[] = JSON.parse(item.product.images);
                      return (
                        <li key={item.productId} className="flex gap-4">
                          {/* Afbeelding */}
                          <Link
                            href={`/products/${item.productId}`}
                            onClick={onClose}
                            className="relative w-20 h-24 flex-shrink-0 overflow-hidden bg-bone"
                          >
                            <Image
                              src={images[0]}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </Link>

                          {/* Info */}
                          <div className="flex-1 min-w-0 flex flex-col">
                            <p className="eyebrow mb-1 truncate">{item.product.category}</p>
                            <h4 className="font-serif text-base text-ink leading-tight mb-2 truncate">
                              {item.product.name}
                            </h4>
                            <p className="font-serif text-sm text-ink mb-auto">
                              &euro;{item.product.price.toFixed(2)}
                            </p>

                            {/* Quantity + Remove */}
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center border border-line">
                                <button
                                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                  className="w-7 h-7 flex items-center justify-center text-stone hover:text-ink transition-colors text-sm"
                                  aria-label="Minder"
                                >
                                  −
                                </button>
                                <span className="w-7 h-7 flex items-center justify-center text-xs text-ink">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center text-stone hover:text-ink transition-colors text-sm"
                                  aria-label="Meer"
                                >
                                  +
                                </button>
                              </div>
                              <button
                                onClick={() => removeFromCart(item.productId)}
                                className="text-[10px] text-stone hover:text-error transition-colors uppercase tracking-wider"
                              >
                                Verwijderen
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Summary + CTAs */}
                <div className="border-t border-line px-6 lg:px-8 py-6 space-y-5 bg-paper">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate">
                      <span>Subtotaal</span>
                      <span className="text-ink">&euro;{totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate">
                      <span>Verzending</span>
                      <span className="text-ink">
                        {shipping === 0 ? "Gratis" : `\u20AC${shipping.toFixed(2)}`}
                      </span>
                    </div>
                    {shipping > 0 && (
                      <p className="text-[10px] text-stone uppercase tracking-[0.2em] pt-1">
                        Gratis verzending vanaf &euro;100
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-baseline pt-4 border-t border-line">
                    <span className="eyebrow">Totaal</span>
                    <span className="font-serif text-2xl text-ink">&euro;{total.toFixed(2)}</span>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Link
                      href="/checkout"
                      onClick={onClose}
                      className="btn-primary w-full text-center block"
                    >
                      Afrekenen
                    </Link>
                    <Link
                      href="/cart"
                      onClick={onClose}
                      className="btn-ghost w-full text-center block"
                    >
                      Bekijk winkelwagen
                    </Link>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
