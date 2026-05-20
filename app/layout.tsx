import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { businessInfo, getActiveSocials } from "@/lib/business-info";
import Footer from "@/components/Footer";
import { CartProvider } from "@/context/CartContext";
import PageTransition from "@/components/PageTransition";
import TouchHoverProvider from "@/components/TouchHoverProvider";
import SmoothScroll from "@/components/SmoothScroll";
import ToastProvider from "@/components/ToastProvider";
import ScrollProgress from "@/components/ScrollProgress";
import CustomCursor from "@/components/CustomCursor";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mokka Home Interior — Modern Wonen, Tijdloos Design",
  description:
    "Ontdek zorgvuldig geselecteerde meubels, verlichting en decoratie voor het moderne interieur. Mokka Home Interior brengt ambachtelijk design met premium kwaliteit.",
  keywords: ["meubels", "woonaccessoires", "verlichting", "interieurdesign", "modern meubilair", "mokka home interior"],
  openGraph: {
    title: "Mokka Home Interior — Modern Wonen, Tijdloos Design",
    description: "Ontdek zorgvuldig geselecteerde meubels, verlichting en decoratie voor het moderne interieur.",
    type: "website",
  },
};

function buildOrganizationSchema() {
  const { legalName, name, address, contact, kvk, btw, foundingYear } = businessInfo;
  const socials = getActiveSocials();

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://mokkahome.nl/#organization",
    name: legalName,
    alternateName: name,
    description: businessInfo.tagline,
    foundingDate: String(foundingYear),
    address: {
      "@type": "PostalAddress",
      streetAddress: address.street,
      postalCode: address.postalCode,
      addressLocality: address.city,
      addressCountry: address.country,
    },
  };
  if (contact.email) schema.email = contact.email;
  if (contact.phone) schema.telephone = contact.phone;
  if (kvk) schema.vatID = btw ?? undefined;
  if (kvk) schema.taxID = kvk;
  if (socials.length > 0) schema.sameAs = socials.map((s) => s.url);

  return schema;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = buildOrganizationSchema();
  return (
    <html lang="nl" className={`${fraunces.variable} ${geist.variable}`}>
      <body className="min-h-screen flex flex-col bg-paper">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <CartProvider>
          <SmoothScroll />
          <TouchHoverProvider />
          <ToastProvider />
          <ScrollProgress />
          <CustomCursor />
          <Navbar />
          <main className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
