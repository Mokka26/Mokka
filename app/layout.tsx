import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CartProvider } from "@/context/CartContext";
import PageTransition from "@/components/PageTransition";
import TouchHoverProvider from "@/components/TouchHoverProvider";
import SmoothScroll from "@/components/SmoothScroll";
import ToastProvider from "@/components/ToastProvider";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen flex flex-col bg-paper">
        <CartProvider>
          <SmoothScroll />
          <TouchHoverProvider />
          <ToastProvider />
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
