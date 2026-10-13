"use client";

import { useEffect } from "react";
import { clearCart } from "@/context/CartContext";

// Leegt de winkelwagen één keer per geslaagde bestelling. De bedankpagina
// kan later opnieuw geopend worden (terug-knop, bladwijzer, refresh) terwijl
// de klant intussen al wéér iets in de wagen heeft gelegd — dan niet nogmaals
// leegmaken. Sleutel: het ordernummer (prop) of anders de order-token/het
// ordernummer uit de URL (?t= / ?order=); zonder sleutel één keer per mount.
const FLAG_PREFIX = "mokka_cart_cleared:";

function orderKeyFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("t") ?? params.get("order") ?? null;
  } catch {
    return null;
  }
}

export default function ClearCart({ orderNumber }: { orderNumber?: string }) {
  useEffect(() => {
    const key = orderNumber ?? orderKeyFromUrl();
    if (!key) {
      clearCart();
      return;
    }
    const flag = `${FLAG_PREFIX}${key}`;
    try {
      if (localStorage.getItem(flag) === "1") return;
      localStorage.setItem(flag, "1");
    } catch {
      // localStorage geblokkeerd: dan hooguit één keer extra leegmaken.
    }
    clearCart();
  }, [orderNumber]);
  return null;
}
