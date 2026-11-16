import type { Metadata } from "next";
import AanbiedingenPage, { generateMetadata as aanbiedingenMetadata } from "@/app/aanbiedingen/page";

/**
 * ISR-variant van /aanbiedingen (pagina 1, zonder query), zoals de
 * categoriepagina's: proxy.ts herschrijft de kale URL hierheen, bezoekers en
 * Google zien gewoon /aanbiedingen (canonical ook). Geen echte searchParams,
 * dus Next kan de pagina statisch cachen; de tag "products" (getSaleProducts)
 * ververst hem bij elke productwijziging. ?page=2 e.v. blijven via
 * app/aanbiedingen/page.tsx dynamisch.
 */
export const revalidate = 3600;

const NO_QUERY = { searchParams: Promise.resolve({}) };

export async function generateMetadata(): Promise<Metadata> {
  return aanbiedingenMetadata(NO_QUERY);
}

export default function CachedAanbiedingenPage() {
  return <AanbiedingenPage {...NO_QUERY} />;
}
