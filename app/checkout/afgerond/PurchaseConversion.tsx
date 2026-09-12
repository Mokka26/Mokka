"use client";

import { useEffect } from "react";
import { getCookieConsent } from "@/components/CookieBanner";

// Google Ads "Purchase"-conversie op de bedankpagina. Vuurt één keer per
// bestelnummer (localStorage-vlag, dus ook niet bij refresh of terugkomen),
// alleen na cookie-akkoord en alleen als de Google-tag (components/
// GoogleAdsTag.tsx) al is gestart — die definieert window.gtag en zet de
// 'config' vóór ons event in de dataLayer, zodat de volgorde altijd klopt.
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const PURCHASE_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
const STORAGE_PREFIX = "mokka_ads_purchase_";
const CURRENCY = "EUR"; // zelfde valuta als components/ui/price.tsx en Mollie
const POLL_MS = 250;
const MAX_POLLS = 40; // 10 s wachten op gtag, daarna opgeven

type Gtag = (...args: unknown[]) => void;

function getGtag(): Gtag | null {
  const candidate: unknown = (window as Window & { gtag?: unknown }).gtag;
  return typeof candidate === "function" ? (candidate as Gtag) : null;
}

function alreadyReported(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markReported(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // localStorage geblokkeerd — hooguit een dubbele melding bij refresh
  }
}

type Props = {
  orderNumber: string;
  value: number;
  newCustomer: boolean;
};

export function PurchaseConversion({ orderNumber, value, newCustomer }: Props) {
  useEffect(() => {
    if (!ADS_ID || !PURCHASE_LABEL) return;

    const key = STORAGE_PREFIX + orderNumber;
    let polls = 0;
    let timer: number | undefined;
    let done = false;

    const attempt = () => {
      if (done || alreadyReported(key)) return;
      if (getCookieConsent() !== "accepted") return; // wacht op consent-event

      const gtag = getGtag();
      if (!gtag) {
        if (polls++ < MAX_POLLS) timer = window.setTimeout(attempt, POLL_MS);
        return;
      }

      done = true;
      gtag("event", "conversion", {
        send_to: `${ADS_ID}/${PURCHASE_LABEL}`,
        value,
        currency: CURRENCY,
        transaction_id: orderNumber,
        new_customer: newCustomer,
      });
      markReported(key);
    };

    attempt();
    window.addEventListener("cookieConsentChanged", attempt);
    return () => {
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener("cookieConsentChanged", attempt);
    };
  }, [orderNumber, value, newCustomer]);

  return null;
}
