"use client";

// CartContext — useSyncExternalStore pattern (React 19).
//
// Waarom geen useState + Context meer:
// - Bij elke addToCart triggerde de oude Context-aanpak een re-render van ALLE
//   consumers (40+ componenten). useSyncExternalStore re-rendert alleen
//   wanneer getSnapshot een nieuwe reference teruggeeft.
// - Hydration-warning weg: server snapshot = lege array (stabiele referentie);
//   client hydrateert in useEffect, dezelfde stabiele reference als de server
//   tot de eerste mutatie. Geen mismatch.
// - Actions zijn module-level → stabiele referenties tussen renders, voorkomt
//   onnodige rerenders in componenten die alleen actions gebruiken.
// - Bonus: cross-tab sync via storage event.

import { useSyncExternalStore, useEffect, type ReactNode } from "react";

export interface CartProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  images: string;
  category: string;
}

export interface CartItemType {
  productId: string;
  quantity: number;
  product: CartProduct;
}

const CART_KEY = "mokka_cart";

// Stabiele lege reference voor SSR-snapshot — voorkomt hydration mismatch
const EMPTY: CartItemType[] = [];

let items: CartItemType[] = EMPTY;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CartItemType[] {
  return items;
}

function getServerSnapshot(): CartItemType[] {
  return EMPTY;
}

function emit() {
  for (const l of listeners) l();
}

function persist(next: CartItemType[]) {
  items = next;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  } catch {
    // localStorage vol of geblokkeerd — silent (cart blijft in memory)
  }
  emit();
}

// ─── Public actions (module-level → stabiele refs) ───

export function addToCart(product: CartProduct) {
  const existing = items.find((i) => i.productId === product.id);
  if (existing) {
    persist(
      items.map((i) =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
      ),
    );
  } else {
    persist([...items, { productId: product.id, quantity: 1, product }]);
  }
}

export function removeFromCart(productId: string) {
  persist(items.filter((i) => i.productId !== productId));
}

export function updateQuantity(productId: string, quantity: number) {
  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  persist(items.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
}

export function clearCart() {
  items = EMPTY;
  try {
    localStorage.removeItem(CART_KEY);
  } catch {
    // ignore
  }
  emit();
}

// ─── Hydration + cross-tab sync ───

let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const saved = localStorage.getItem(CART_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        items = parsed;
        emit();
      }
    }
  } catch {
    try {
      localStorage.removeItem(CART_KEY);
    } catch {
      // ignore
    }
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== CART_KEY) return;
    if (e.newValue === null) {
      items = EMPTY;
      emit();
      return;
    }
    try {
      const parsed = JSON.parse(e.newValue);
      if (Array.isArray(parsed)) {
        items = parsed;
        emit();
      }
    } catch {
      // ignore corrupt cross-tab update
    }
  });
}

// CartProvider blijft als hydration-trigger; geen daadwerkelijke context.
// Bestaande layout.tsx kan ongewijzigd blijven.
export function CartProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    hydrate();
  }, []);
  return <>{children}</>;
}

// ─── Hook ───

export function useCart() {
  const currentItems = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const totalItems = currentItems.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = currentItems.reduce((s, i) => s + i.product.price * i.quantity, 0);
  return {
    items: currentItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
  };
}
