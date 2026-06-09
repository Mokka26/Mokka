"use client";

import { useEffect } from "react";
import { clearCart } from "@/context/CartContext";

// Leegt de winkelwagen één keer na een geslaagde betaling.
export default function ClearCart() {
  useEffect(() => {
    clearCart();
  }, []);
  return null;
}
