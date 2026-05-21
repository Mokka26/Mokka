import type { Metadata } from "next";
import { businessInfo } from "@/lib/business-info";

export const metadata: Metadata = {
  title: `Contact — ${businessInfo.name}`,
  description: `Vragen, advies of een afspraak? Bezoek onze showroom in ${businessInfo.address.city} of stuur een bericht via het formulier.`,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `Contact — ${businessInfo.name}`,
    description: "Bezoek onze showroom of stuur een bericht. We reageren binnen 24 uur.",
    type: "website",
    url: "/contact",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
