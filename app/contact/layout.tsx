import type { Metadata } from "next";
import { businessInfo } from "@/lib/business-info";

const description = `Vragen over een product, je bestelling of een afspraak? Bel ons, stuur een bericht via het formulier of kom langs in de showroom in ${businessInfo.address.city}.`;

export const metadata: Metadata = {
  title: `Contact en showroom in ${businessInfo.address.city}: bel of mail`,
  description,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `Contact | ${businessInfo.name}`,
    description,
    type: "website",
    url: "/contact",
    locale: "nl_NL",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
