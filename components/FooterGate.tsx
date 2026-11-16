"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isCheckoutFlow } from "@/components/checkout/CheckoutGate";

// Dunne client-schil: verbergt de (server-gerenderde) footer op /admin en op
// /checkout (die heeft een eigen kale footer, app/checkout/layout.tsx).
// De footer zelf blijft een server component; alleen de pathname-check
// heeft een client-hook nodig.
export function FooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin") || isCheckoutFlow(pathname)) return null;
  return <>{children}</>;
}
