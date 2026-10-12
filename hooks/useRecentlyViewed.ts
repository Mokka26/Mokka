"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "mokka_recently_viewed_v1";
const MAX_ITEMS = 12;

// Stabiele lege referentie: server-snapshot én client-snapshot vóór hydratie
// zijn hetzelfde object → geen hydration mismatch, geen cascade-renders.
const EMPTY: string[] = [];

let cached: string[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const list = parsed.filter((s): s is string => typeof s === "string");
    return list.length > 0 ? list : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(slugs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage full / disabled — silent
  }
}

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (loaded) return;
  loaded = true;
  cached = read();
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    cached = read();
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => cached;
const getServerSnapshot = () => EMPTY;

/**
 * Tracks recently-viewed product slugs in localStorage.
 * - currentSlug: optional. If given, it's pushed to the front on mount.
 * - Returns the list MINUS currentSlug (don't show "you just viewed" on its own PDP).
 *
 * Hydration-veilig via useSyncExternalStore: de server en de eerste
 * client-render geven dezelfde lege lijst; localStorage wordt pas na mount
 * gelezen.
 */
export function useRecentlyViewed(currentSlug?: string): string[] {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    load();
    if (currentSlug) {
      const next = [currentSlug, ...cached.filter((s) => s !== currentSlug)].slice(0, MAX_ITEMS);
      write(next);
      cached = next;
    }
    emit();
  }, [currentSlug]);

  return useMemo(() => {
    if (!currentSlug) return list;
    const filtered = list.filter((s) => s !== currentSlug);
    return filtered.length === list.length ? list : filtered;
  }, [list, currentSlug]);
}
