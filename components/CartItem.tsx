"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useCart, CartItemType } from "@/context/CartContext";

interface Props {
  item: CartItemType;
}

export default function CartItem({ item }: Props) {
  const { removeFromCart, updateQuantity } = useCart();
  const images: string[] = JSON.parse(item.product.images);
  const itemTotal = item.product.price * item.quantity;

  return (
    <motion.div layout className="grid grid-cols-12 gap-4 items-center py-6 border-b border-line">
      <div className="col-span-12 md:col-span-6 flex gap-5">
        <div className="relative w-20 h-20 bg-white flex-shrink-0 overflow-hidden">
          <Image src={images[0]} alt={item.product.name} fill className="object-cover" sizes="80px" />
        </div>
        <div>
          <h4 className="text-ink text-sm font-medium">{item.product.name}</h4>
          <p className="text-stone text-xs capitalize mt-1">{item.product.category}</p>
          <button onClick={() => removeFromCart(item.productId)} className="text-[10px] text-stone hover:text-error transition-colors mt-2 uppercase tracking-wider">
            Verwijderen
          </button>
        </div>
      </div>
      <div className="col-span-4 md:col-span-2 flex items-center justify-center">
        <div className="flex items-center border border-line">
          <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="px-3 py-2 text-stone hover:text-bronze transition-colors text-sm">-</button>
          <span className="px-3 py-2 text-xs text-ink min-w-[2rem] text-center">{item.quantity}</span>
          <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="px-3 py-2 text-stone hover:text-bronze transition-colors text-sm">+</button>
        </div>
      </div>
      <div className="col-span-4 md:col-span-2 text-right text-stone text-sm font-light">&euro;{item.product.price.toFixed(2)}</div>
      <div className="col-span-4 md:col-span-2 text-right text-ink text-sm font-medium">&euro;{itemTotal.toFixed(2)}</div>
    </motion.div>
  );
}
