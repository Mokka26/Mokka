"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "mokka_recently_viewed_v1";
const MAX_ITEMS = 12;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function write(slugs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage full / disabled — silent
  }
}

/**
 * Tracks recently-viewed product slugs in localStorage.
 * - currentSlug: optional. If given, it's pushed to the front on mount.
 * - Returns the list MINUS currentSlug (don't show "you just viewed" on its own PDP).
 */
export function useRecentlyViewed(currentSlug?: string): string[] {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    const existing = read();
    if (currentSlug) {
      const next = [currentSlug, ...existing.filter((s) => s !== currentSlug)].slice(0, MAX_ITEMS);
      write(next);
      setSlugs(next.filter((s) => s !== currentSlug));
    } else {
      setSlugs(existing);
    }
  }, [currentSlug]);

  return slugs;
}
