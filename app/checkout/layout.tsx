import type { Metadata } from "next";
import { businessInfo } from "@/lib/business-info";

export const metadata: Metadata = {
  title: `Afrekenen — ${businessInfo.name}`,
  description: "Voltooi je bestelling.",
  alternates: { canonical: "/checkout" },
  // Niet indexeren — bevat persoonlijke gegevens, geen SEO-waarde
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
