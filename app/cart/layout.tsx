import type { Metadata } from "next";
import { businessInfo } from "@/lib/business-info";

export const metadata: Metadata = {
  title: "Winkelwagen: je geselecteerde producten",
  description: `Bekijk de producten in je winkelwagen bij ${businessInfo.name}, pas aantallen aan en reken af als gast of met je account. Prijzen incl. btw, verzendkosten zichtbaar.`,
  alternates: { canonical: "/cart" },
  // Niet indexeren — persoonlijke staat (geen SEO-waarde)
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
