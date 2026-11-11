"use client";

import { useEffect } from "react";
import { trackGenerateLead } from "@/lib/analytics";

/**
 * Meet klikken op elk telefoonnummer (tel:-links in header, footer, PDP,
 * checkout) als `generate_lead` — via één luisteraar i.p.v. per link.
 * Verstuurt alleen met analytics-toestemming (zie lib/analytics).
 */
export function PhoneLeadTracking() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target.closest('a[href^="tel:"]') : null;
      if (target) trackGenerateLead("phone");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
