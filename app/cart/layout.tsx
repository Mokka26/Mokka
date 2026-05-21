import type { Metadata } from "next";
import { businessInfo } from "@/lib/business-info";

export const metadata: Metadata = {
  title: `Winkelwagen — ${businessInfo.name}`,
  description: "Je geselecteerde producten.",
  alternates: { canonical: "/cart" },
  // Niet indexeren — persoonlijke staat (geen SEO-waarde)
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
