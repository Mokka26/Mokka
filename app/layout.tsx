import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { buildOrganizationJsonLd, buildWebSiteJsonLd, jsonLdHtml } from "@/lib/jsonLd";
import Footer from "@/components/Footer";
import { getFooterMethods } from "@/lib/mollie";
import { CartProvider } from "@/context/CartContext";
import PageTransition from "@/components/PageTransition";
import MotionProvider from "@/components/MotionProvider";
import ToastProvider from "@/components/ToastProvider";
import CookieBanner from "@/components/CookieBanner";
import { Analytics } from "@/components/Analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Source Serif 4 (display-serif) — leesbaar voor brede doelgroep (27-70),
// behoudt serif-karakter (industrial-luxe brand) zonder Fraunces' ornament.
// preload=false: titles zijn niet altijd above-the-fold; display:swap geeft
// directe paint met system-fallback.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  variable: "--font-serif-display",
  display: "swap",
  preload: false,
});

// Geist (sans) — body text op elke pagina, preload=true (default) terecht.
const geist = Geist({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-geist",
  display: "swap",
});

// Alleen voor routes zónder eigen title; het template "%s | Mokka Home" plakt
// de merknaam achter alle andere titels, dus hier geen " | Mokka Home" erbij.
const DEFAULT_TITLE = `${businessInfo.name}: meubels en verlichting, showroom ${businessInfo.address.city}`;
const DEFAULT_DESCRIPTION = `Banken, eettafels, stoelen, kasten, bedden en verlichting van ${businessInfo.name}. Prijzen incl. btw, ${shippingInfo.returnWindowDays} dagen bedenktijd en een showroom in ${businessInfo.address.city}.`;

export const metadata: Metadata = {
  metadataBase: new URL(businessInfo.siteUrl),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${businessInfo.name}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: businessInfo.name,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    siteName: businessInfo.name,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    type: "website",
    locale: "nl_NL",
  },
};

// viewportFit "cover": safe-area-insets (iPhone-notch/home-bar) werken voor de
// vaste balken onderaan. themeColor = de paper-token (--color-paper in globals.css).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4F0E8",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const footerMethods = await getFooterMethods();
  const organizationSchema = buildOrganizationJsonLd();
  const webSiteSchema = buildWebSiteJsonLd();
  return (
    <html lang="nl" data-scroll-behavior="smooth" className={`${sourceSerif.variable} ${geist.variable}`}>
      <head>
        {/* Preconnect naar Cloudinary CDN — slaat DNS+TLS-handshake (~150-300ms)
            over voor eerste image-request. Cruciaal want we gebruiken unoptimized
            zodat images direct van Cloudinary komen, niet via Next-proxy. */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body className="min-h-screen flex flex-col bg-paper">
        {/* Skip-link: eerste focusbare element, zichtbaar zodra 'ie focus krijgt. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-ink focus:text-paper focus:px-5 focus:py-3 focus:text-[15px] focus:outline-none focus:ring-2 focus:ring-accent"
        >
          Ga naar inhoud
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(webSiteSchema) }}
        />
        <MotionProvider>
          <CartProvider>
            <ToastProvider />
            <Navbar />
            <main id="main" className="flex-1">
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer mollieMethods={footerMethods} />
            <CookieBanner />
          </CartProvider>
        </MotionProvider>
        <SpeedInsights />
        {/* Google-tag (GA4 + Ads) met Consent Mode v2 — zie components/Analytics.tsx. */}
        <Analytics />
      </body>
    </html>
  );
}
