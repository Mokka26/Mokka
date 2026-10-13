/**
 * Klein pub/sub-kanaal tussen ImageManager en EditProductForm (buren op de
 * product-bewerkpagina zonder gedeelde client-ouder). Zodra een foto-actie
 * het product op de server bijwerkt, verandert `updatedAt`; het formulier
 * moet die nieuwe waarde kennen voor zijn optimistic lock, anders weigert
 * de volgende "Wijzigingen opslaan" met "formulier is verouderd".
 */

const EVENT_NAME = "mokka:admin-product-updated";

export type ProductUpdatedDetail = {
  id: string;
  /** Nieuwe updatedAt (ISO) als de server die teruggaf; anders undefined. */
  updatedAt?: string;
};

export function dispatchProductUpdated(detail: ProductUpdatedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ProductUpdatedDetail>(EVENT_NAME, { detail }));
}

export function subscribeProductUpdated(listener: (detail: ProductUpdatedDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ProductUpdatedDetail>).detail;
    if (detail && typeof detail.id === "string") listener(detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

/** Leest `updatedAt` uit een server-resultaat zodra de backend dat meestuurt. */
export function readUpdatedAt(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const value = (result as { updatedAt?: unknown }).updatedAt;
  return typeof value === "string" && value ? value : undefined;
}
