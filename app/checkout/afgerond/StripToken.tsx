"use client";

import { useEffect } from "react";
import { stripTokenFromUrl } from "./token";

/**
 * Vangnet naast het inline script in page.tsx: haalt `?t=` alsnog uit de
 * adresbalk als die er na hydratatie nog staat (Next.js synchroniseert zijn
 * router met history.replaceState).
 */
export function StripToken() {
  useEffect(() => {
    stripTokenFromUrl();
  }, []);
  return null;
}
