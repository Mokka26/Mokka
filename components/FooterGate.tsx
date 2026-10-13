"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Dunne client-schil: verbergt de (server-gerenderde) footer op /admin.
// De footer zelf blijft een server component; alleen de pathname-check
// heeft een client-hook nodig.
export function FooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
