import type { ReactNode } from "react";

// Bewust een kale wrapper: de vorige versie verborg de volledige <main>
// server-side (clip-path + opacity 0) tot hydratie, waardoor niets zichtbaar
// was vóór JavaScript en de LCP op élke route werd uitgesteld. Content staat
// nu direct in de eerste paint; er is geen key={pathname}-remount meer.
export default function PageTransition({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
