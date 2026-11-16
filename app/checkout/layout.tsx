import type { Metadata } from "next";
import { businessInfo } from "@/lib/business-info";
import { CheckoutFooter, CheckoutHeader } from "@/components/checkout/CheckoutChrome";
import { CheckoutOnly } from "@/components/checkout/CheckoutGate";

export const metadata: Metadata = {
  title: "Afrekenen: bestelling afronden in drie stappen",
  description: `Rond je bestelling bij ${businessInfo.name} af: adres, verzending en betaling via iDEAL, creditcard of achteraf betalen. Gast-checkout mogelijk, prijzen incl. btw.`,
  alternates: { canonical: "/checkout" },
  // Niet indexeren — bevat persoonlijke gegevens, geen SEO-waarde
  robots: { index: false, follow: false },
};

// Kale omlijsting op /checkout (UX: geen megamenu/USP-balk/nieuwsbrief tijdens
// het afrekenen); de gewone Navbar en Footer verbergen zich daar zelf.
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CheckoutOnly>
        <CheckoutHeader />
      </CheckoutOnly>
      {children}
      <CheckoutOnly>
        <CheckoutFooter />
      </CheckoutOnly>
    </>
  );
}
