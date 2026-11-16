"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** De kale checkout-omlijsting geldt alleen voor de afrekenpagina zelf. */
export function isCheckoutFlow(pathname: string | null): boolean {
  return pathname === "/checkout";
}

// Dunne client-schil (zoals FooterGate): toont de server-gerenderde
// checkout-header/-footer alleen op /checkout; de bedankpagina
// (/checkout/afgerond) houdt de gewone site-navigatie om verder te winkelen.
export function CheckoutOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!isCheckoutFlow(pathname)) return null;
  return <>{children}</>;
}
