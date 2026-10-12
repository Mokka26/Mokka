import type { Metadata } from "next";
import { businessInfo } from "@/lib/business-info";

export const metadata: Metadata = {
  title: "Afrekenen: bestelling afronden in drie stappen",
  description: `Rond je bestelling bij ${businessInfo.name} af: adres, verzending en betaling via iDEAL, creditcard of achteraf betalen. Gast-checkout mogelijk, prijzen incl. btw.`,
  alternates: { canonical: "/checkout" },
  // Niet indexeren — bevat persoonlijke gegevens, geen SEO-waarde
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
