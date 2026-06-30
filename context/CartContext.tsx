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
  /** Unieke regel-sleutel: productId(::maat)(::nkN) — maat + nachtkast-keuze. */
  lineKey: string;
  productId: string;
  /** Gekozen maat (bv. "140 × 200"); null bij producten zonder maatkeuze. */
  variantLabel: string | null;
  /** Aantal nachtkasten erbij (0/1/2); 0 = geen. */
  nachtkast: number;
  quantity: number;
  product: CartProduct;
}

/** Regel-sleutel: productId, + ::maat bij maat, + ::nkN bij nachtkasten. */
export function makeLineKey(productId: string, variantLabel?: string | null, nachtkast = 0): string {
  let key = variantLabel ? `${productId}::${variantLabel}` : productId;
  if (nachtkast > 0) key += `::nk${nachtkast}`;
  return key;
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

export function addToCart(product: CartProduct, variantLabel?: string | null, nachtkast = 0) {
  // product.price moet al de regel-prijs zijn (maatprijs + evt. nachtkasten).
  const lineKey = makeLineKey(product.id, variantLabel, nachtkast);
  const existing = items.find((i) => i.lineKey === lineKey);
  if (existing) {
    persist(
      items.map((i) => (i.lineKey === lineKey ? { ...i, quantity: i.quantity + 1 } : i)),
    );
  } else {
    persist([
      ...items,
      { lineKey, productId: product.id, variantLabel: variantLabel ?? null, nachtkast, quantity: 1, product },
    ]);
  }
}

export function removeFromCart(lineKey: string) {
  persist(items.filter((i) => i.lineKey !== lineKey));
}

export function updateQuantity(lineKey: string, quantity: number) {
  if (quantity <= 0) {
    removeFromCart(lineKey);
    return;
  }
  persist(items.map((i) => (i.lineKey === lineKey ? { ...i, quantity } : i)));
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

// Oudere opgeslagen winkelwagens hebben nog geen lineKey/variantLabel — vul aan.
function normalize(arr: unknown): CartItemType[] {
  if (!Array.isArray(arr)) return EMPTY;
  return arr
    .filter((i): i is CartItemType => !!i && typeof i.productId === "string")
    .map((i) => ({
      ...i,
      variantLabel: i.variantLabel ?? null,
      nachtkast: typeof i.nachtkast === "number" ? i.nachtkast : 0,
      lineKey: i.lineKey ?? makeLineKey(i.productId, i.variantLabel ?? null, i.nachtkast ?? 0),
    }));
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const saved = localStorage.getItem(CART_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        items = normalize(parsed);
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
        items = normalize(parsed);
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
