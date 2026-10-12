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
//
// Prijzen in de winkelwagen zijn een momentopname (localStorage). Op /cart en
// /checkout wordt de wagen via `useCartSync` tegen de server gecontroleerd
// (getCartSnapshot) en bijgewerkt bij prijs-/voorraadwijzigingen.

import { useSyncExternalStore, useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { getCartSnapshot, type CartSnapshotLine } from "@/app/cart/actions";
import { formatPrice } from "@/components/ui/price";

export interface CartProduct {
  id: string;
  slug: string;
  name: string;
  /** Regel-stukprijs (maatprijs + opties) op het moment van toevoegen. */
  price: number;
  images: string;
  category: string;
  listPrice?: number | null;
  deliveryTime?: string | null;
  stock?: number | null;
}

export interface CartItemType {
  /** Unieke regel-sleutel: productId(::maat)(::nkN) — maat + nachtkast-keuze. */
  lineKey: string;
  productId: string;
  /** Gekozen maat (bv. "140 × 200"); null bij producten zonder maatkeuze. */
  variantLabel: string | null;
  /** Aantal nachtkasten erbij (0/1/2); 0 = geen. */
  nachtkast: number;
  /** Voetbank erbij (0/1); 0 = geen. */
  voetbank: number;
  quantity: number;
  product: CartProduct;
}

/** Regel-sleutel: productId, + ::maat, + ::nkN (nachtkast), + ::vbN (voetbank). */
export function makeLineKey(productId: string, variantLabel?: string | null, nachtkast = 0, voetbank = 0): string {
  let key = variantLabel ? `${productId}::${variantLabel}` : productId;
  if (nachtkast > 0) key += `::nk${nachtkast}`;
  if (voetbank > 0) key += `::vb${voetbank}`;
  return key;
}

const CART_KEY = "mokka_cart";
const MAX_QTY = 99;

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

export function addToCart(
  product: CartProduct,
  variantLabel?: string | null,
  nachtkast = 0,
  voetbank = 0,
  quantity = 1,
) {
  // product.price moet al de regel-prijs zijn (maatprijs + nachtkast + voetbank).
  const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(quantity)));
  const lineKey = makeLineKey(product.id, variantLabel, nachtkast, voetbank);
  const existing = items.find((i) => i.lineKey === lineKey);
  if (existing) {
    persist(
      items.map((i) =>
        i.lineKey === lineKey ? { ...i, product, quantity: Math.min(MAX_QTY, i.quantity + qty) } : i,
      ),
    );
    return;
  }
  persist([
    ...items,
    { lineKey, productId: product.id, variantLabel: variantLabel ?? null, nachtkast, voetbank, quantity: qty, product },
  ]);
}

/** Verwijdert een regel en geeft 'm terug (voor "Ongedaan maken"). */
export function removeFromCart(lineKey: string): { item: CartItemType; index: number } | null {
  const index = items.findIndex((i) => i.lineKey === lineKey);
  if (index === -1) return null;
  const item = items[index];
  persist(items.filter((i) => i.lineKey !== lineKey));
  return { item, index };
}

/** Zet een eerder verwijderde regel terug op zijn oude positie. */
export function restoreItem(item: CartItemType, index?: number) {
  if (items.some((i) => i.lineKey === item.lineKey)) return;
  const next = [...items];
  const at = index === undefined ? next.length : Math.max(0, Math.min(index, next.length));
  next.splice(at, 0, item);
  persist(next);
}

/** Verwijderen met in-UI "Ongedaan maken" (toast, 6 s). */
export function removeWithUndo(lineKey: string) {
  const removed = removeFromCart(lineKey);
  if (!removed) return;
  const { item, index } = removed;
  toast(`${item.product.name} verwijderd uit je winkelwagen`, {
    duration: 6000,
    action: {
      label: "Ongedaan maken",
      onClick: () => restoreItem(item, index),
    },
  });
}

export function updateQuantity(lineKey: string, quantity: number) {
  if (quantity <= 0) {
    removeFromCart(lineKey);
    return;
  }
  const qty = Math.min(MAX_QTY, Math.floor(quantity));
  persist(items.map((i) => (i.lineKey === lineKey ? { ...i, quantity: qty } : i)));
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

// ─── Server-synchronisatie (prijs/voorraad/beschikbaarheid) ───

export type CartSyncChange = {
  type: "price" | "removed" | "quantity";
  lineKey: string;
  message: string;
};

const sameCents = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);

function snapshotKey(line: CartSnapshotLine): string | null {
  const pid = line.key.productId ?? line.productId;
  if (!pid) return null;
  return makeLineKey(pid, line.key.variantLabel, line.key.nachtkast, line.key.voetbank);
}

/**
 * Past een server-snapshot (getCartSnapshot, zelfde volgorde als de input)
 * toe op de winkelwagen. Regels die niet meer leverbaar zijn verdwijnen,
 * prijzen worden bijgewerkt, aantallen boven de voorraad worden verlaagd.
 * Geeft een lijst meldingen terug voor de UI.
 */
export function applyCartSnapshot(snapshot: ReadonlyArray<CartSnapshotLine>, requested: ReadonlyArray<CartItemType> = items): CartSyncChange[] {
  if (!Array.isArray(snapshot) || snapshot.length === 0 || items.length === 0) return [];

  // Koppel op regelsleutel; val terug op positie (snapshot volgt de inputvolgorde).
  const byKey = new Map<string, CartSnapshotLine>();
  snapshot.forEach((line, i) => {
    const key = snapshotKey(line) ?? requested[i]?.lineKey ?? null;
    if (key && !byKey.has(key)) byKey.set(key, line);
  });

  const changes: CartSyncChange[] = [];
  const next: CartItemType[] = [];
  for (const item of items) {
    const snap = byKey.get(item.lineKey);
    if (!snap) {
      // Niet in de snapshot (bv. regel toegevoegd tijdens de call) → laten staan.
      next.push(item);
      continue;
    }
    if (!snap.available) {
      changes.push({
        type: "removed",
        lineKey: item.lineKey,
        message: `${item.product.name} is niet meer leverbaar en is uit je winkelwagen verwijderd.`,
      });
      continue;
    }
    if (!snap.variantValid || snap.price === null || snap.price <= 0) {
      changes.push({
        type: "removed",
        lineKey: item.lineKey,
        message: item.variantLabel
          ? `De maat ${item.variantLabel} van ${item.product.name} is niet meer beschikbaar; kies de maat opnieuw.`
          : `${item.product.name} heeft op dit moment geen geldige prijs en is uit je winkelwagen verwijderd.`,
      });
      continue;
    }
    if (snap.stock <= 0) {
      changes.push({
        type: "removed",
        lineKey: item.lineKey,
        message: `${item.product.name} is uitverkocht en is uit je winkelwagen verwijderd.`,
      });
      continue;
    }

    const product: CartProduct = {
      ...item.product,
      price: snap.price,
      listPrice: snap.listPrice,
      name: snap.name ?? item.product.name,
      images: snap.image ? JSON.stringify([snap.image]) : item.product.images,
      slug: snap.slug ?? item.product.slug,
      category: snap.category ?? item.product.category,
      stock: snap.stock,
    };
    let updated: CartItemType = { ...item, product };
    if (!sameCents(item.product.price, snap.price)) {
      changes.push({
        type: "price",
        lineKey: item.lineKey,
        message: `De prijs van ${item.product.name} is gewijzigd naar ${formatPrice(snap.price)}.`,
      });
    }
    if (item.quantity > snap.stock) {
      changes.push({
        type: "quantity",
        lineKey: item.lineKey,
        message: `Van ${item.product.name} ${snap.stock === 1 ? "is er nog 1" : `zijn er nog ${snap.stock}`} op voorraad; het aantal is aangepast.`,
      });
      updated = { ...updated, quantity: snap.stock };
    }
    next.push(updated);
  }

  if (changes.length > 0) persist(next);
  return changes;
}

/** Haalt de actuele server-staat op en past die toe. Faalt stil (netwerk). */
export async function syncCart(): Promise<CartSyncChange[]> {
  if (items.length === 0) return [];
  const requested = items;
  try {
    const snapshot = await getCartSnapshot(
      requested.map((i) => ({
        productId: i.productId,
        variantLabel: i.variantLabel,
        nachtkast: i.nachtkast,
        voetbank: i.voetbank,
      })),
    );
    return applyCartSnapshot(snapshot, requested);
  } catch {
    return [];
  }
}

/** Toont de sync-meldingen als toasts (één per wijziging). */
export function announceCartChanges(changes: CartSyncChange[]) {
  for (const c of changes) {
    if (c.type === "removed") toast.warning(c.message, { duration: 8000 });
    else toast.info(c.message, { duration: 8000 });
  }
}

/**
 * Synchroniseert de winkelwagen één keer per pagina-bezoek met de server
 * (gebruik op /cart en /checkout). Wacht tot de wagen uit localStorage is
 * gehydrateerd.
 */
export function useCartSync(enabled = true) {
  const currentItems = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ran = useRef(false);
  useEffect(() => {
    if (!enabled || ran.current || currentItems.length === 0) return;
    ran.current = true;
    let active = true;
    syncCart().then((changes) => {
      if (active) announceCartChanges(changes);
    });
    return () => {
      active = false;
    };
  }, [enabled, currentItems.length]);
}

// ─── Hydration + cross-tab sync ───

let hydrated = false;

// Oudere opgeslagen winkelwagens hebben nog geen lineKey/variantLabel — vul aan.
function normalize(arr: unknown): CartItemType[] {
  if (!Array.isArray(arr)) return EMPTY;
  return arr
    .filter((i): i is CartItemType => !!i && typeof i.productId === "string" && !!i.product)
    .map((i) => ({
      ...i,
      variantLabel: i.variantLabel ?? null,
      nachtkast: typeof i.nachtkast === "number" ? i.nachtkast : 0,
      voetbank: typeof i.voetbank === "number" ? i.voetbank : 0,
      quantity: typeof i.quantity === "number" && i.quantity > 0 ? Math.min(MAX_QTY, Math.floor(i.quantity)) : 1,
      lineKey: i.lineKey ?? makeLineKey(i.productId, i.variantLabel ?? null, i.nachtkast ?? 0, i.voetbank ?? 0),
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
    removeWithUndo,
    restoreItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
  };
}
