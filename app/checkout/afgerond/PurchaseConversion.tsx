"use client";

import { useEffect } from "react";
import { getCookieConsent } from "@/components/CookieBanner";
import {
  isAnalyticsEnabled,
  isPurchaseReported,
  getGtag,
  setUserData,
  trackPurchase,
  type AnalyticsOrderItem,
  type UserData,
} from "@/lib/analytics";

// Purchase-meting op de bedankpagina: GA4 `purchase` + Google Ads-conversie
// (lib/analytics.ts), één keer per bestelnummer (localStorage-vlag, dus ook
// niet bij refresh of terugkomen). De pagina rendert dit alleen bij status
// 'paid' en een vertrouwde token.
//
// Volgorde: (1) wachten tot window.gtag bestaat (components/Analytics.tsx);
// (2) als de bezoeker nog geen cookiekeuze maakte, even wachten op de banner —
// anders gaat het event cookieloos (Consent Mode 'denied') en kan het niet
// meer aan de klik gekoppeld worden; na MAX_WAIT alsnog cookieloos sturen
// zodat Google het kan modelleren; (3) bij akkoord eerst Enhanced Conversions
// user_data zetten (gtag hasht client-side), dán de events.
const POLL_MS = 250;
const MAX_POLLS = 60; // 15 s

type Props = {
  orderNumber: string;
  /** Ordertotaal incl. btw en verzending. */
  value: number;
  shipping: number;
  newCustomer: boolean;
  items: AnalyticsOrderItem[];
  paymentMethod: string | null;
  /** Klantgegevens voor Enhanced Conversions; nooit loggen. */
  userData: UserData | null;
};

export function PurchaseConversion({ orderNumber, value, shipping, newCustomer, items, paymentMethod, userData }: Props) {
  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    if (isPurchaseReported(orderNumber)) return;

    let polls = 0;
    let timer: number | undefined;
    let done = false;

    const schedule = () => {
      if (polls++ < MAX_POLLS) timer = window.setTimeout(attempt, POLL_MS);
    };

    const attempt = () => {
      if (done) return;
      if (!getGtag()) {
        schedule();
        return;
      }
      const consent = getCookieConsent();
      if (consent === null && polls < MAX_POLLS) {
        schedule(); // banner staat open: wacht op de keuze (cookieConsentChanged)
        return;
      }

      done = true;
      if (consent === "accepted" && userData) setUserData(userData);
      trackPurchase({ orderNumber, total: value, shipping, items, newCustomer, paymentMethod });
    };

    attempt();
    window.addEventListener("cookieConsentChanged", attempt);
    return () => {
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener("cookieConsentChanged", attempt);
    };
  }, [orderNumber, value, shipping, newCustomer, items, paymentMethod, userData]);

  return null;
}
