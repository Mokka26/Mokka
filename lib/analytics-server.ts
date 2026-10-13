import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { captureError } from "@/lib/sentry";
import { shippingInfo } from "@/lib/shipping-info";

// Server-side purchase naar GA4 via het Measurement Protocol — het vangnet
// voor conversies die de browser mist (adblocker, bedankpagina niet geladen,
// cookieloos). Aangeroepen vanuit lib/order-sync.ts, uitsluitend in het codepad
// dat de order daadwerkelijk naar 'paid' claimt (dus nooit dubbel: webhook,
// retourpagina en reconcile-cron delen die ene claim).
//
// Zonder GA4_API_SECRET of NEXT_PUBLIC_GA4_ID: no-op. Fouten gaan naar Sentry
// (captureError) en breken nooit de betaalverwerking.
//
// Toestemming: de klant heeft bij het bestellen wel of niet de cookies
// geaccepteerd (`Order.analyticsConsent`). Zonder akkoord sturen we NIETS —
// ook geen server-side purchase; dat zou de cookiekeuze omzeilen.
//
// Beperking — client_id: GA4 ontdubbelt purchase-events op transaction_id
// alleen binnen dezelfde client_id. De browser-purchase (PurchaseConversion)
// gebruikt het echte `_ga`-cookie-id; dat id staat niet op de Order (geen
// `gaClientId`-veld), dus hier gebruiken we een deterministisch id uit
// publicToken. Een gelijknamig `purchase` zou dan DUBBEL tellen in GA4.
// Daarom heet het server-event `server_purchase` (zelfde parameters) totdat
// Order een `gaClientId` krijgt — dan kan SERVER_PURCHASE_EVENT naar
// "purchase" en ontdubbelt GA4 het zelf. Zie docs/tracking.md.

const MP_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const CURRENCY = "EUR";
const TIMEOUT_MS = 4000;
export const SERVER_PURCHASE_EVENT = "server_purchase";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
const API_SECRET = process.env.GA4_API_SECRET;
const GA4_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

export const isServerAnalyticsEnabled = (): boolean =>
  Boolean(GA4_ID && GA4_ID_PATTERN.test(GA4_ID) && API_SECRET);

export type ServerPurchaseOrder = {
  orderNumber: string;
  publicToken: string | null;
  total: number;
  shipping: number;
  paymentMethod: string | null;
  paidAt: Date | null;
  /** Cookie-akkoord op het moment van bestellen; zonder akkoord geen event. */
  analyticsConsent: boolean;
  /** Bekend GA-client-id (uit de `_ga`-cookie) als dat ooit op de Order komt. */
  gaClientId?: string | null;
  items: ReadonlyArray<{ productId: string; productName: string; variantLabel: string | null; quantity: number; price: number }>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Deterministische client_id in GA-vorm ("1234567890.1234567890") uit de
 * publicToken (of het ordernummer): stabiel per order, niet herleidbaar.
 */
export function deterministicClientId(seed: string): string {
  const hex = createHash("sha256").update(`mokka-ga4:${seed}`).digest("hex");
  const a = parseInt(hex.slice(0, 8), 16).toString().padStart(10, "0").slice(0, 10);
  const b = parseInt(hex.slice(8, 16), 16).toString().padStart(10, "0").slice(0, 10);
  return `${a}.${b}`;
}

export function buildPurchasePayload(order: ServerPurchaseOrder): Record<string, unknown> {
  const items = order.items.map((it) => ({
    item_id: it.productId,
    item_name: it.productName,
    ...(it.variantLabel ? { item_variant: it.variantLabel } : {}),
    price: round2(it.price),
    quantity: Math.max(1, Math.floor(it.quantity)),
  }));
  const value = items.length > 0 ? round2(items.reduce((s, it) => s + it.price * it.quantity, 0)) : round2(order.total - order.shipping);
  const tax = round2(order.total - order.total / (1 + shippingInfo.vatRatePercent / 100));
  const clientId = order.gaClientId?.trim() || deterministicClientId(order.publicToken || order.orderNumber);
  const eventName = order.gaClientId?.trim() ? "purchase" : SERVER_PURCHASE_EVENT;
  const at = order.paidAt ?? new Date();

  return {
    client_id: clientId,
    timestamp_micros: at.getTime() * 1000,
    non_personalized_ads: true,
    events: [
      {
        name: eventName,
        params: {
          transaction_id: order.orderNumber,
          value,
          tax,
          shipping: round2(order.shipping),
          currency: CURRENCY,
          ...(order.paymentMethod ? { payment_type: order.paymentMethod } : {}),
          items,
          // Zonder engagement_time_msec telt GA4 de gebruiker niet als actief.
          engagement_time_msec: 100,
        },
      },
    ],
  };
}

/** Alleen met cookie-akkoord én geconfigureerde GA4-koppeling versturen we iets. */
export function shouldSendServerPurchase(order: Pick<ServerPurchaseOrder, "analyticsConsent">): boolean {
  return order.analyticsConsent === true && isServerAnalyticsEnabled();
}

/**
 * Verstuurt de purchase naar GA4. Gooit nooit; retourneert of het gelukt is.
 * Zonder cookie-akkoord (analyticsConsent) wordt niets verstuurd.
 */
export async function sendServerPurchase(order: ServerPurchaseOrder): Promise<boolean> {
  if (!shouldSendServerPurchase(order)) return false;
  try {
    const url = `${MP_ENDPOINT}?measurement_id=${encodeURIComponent(GA4_ID!)}&api_secret=${encodeURIComponent(API_SECRET!)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPurchasePayload(order)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Het MP antwoordt 2xx ook bij inhoudelijk afgekeurde events; alleen
    // transportfouten zijn hier zichtbaar. Validatie: docs/tracking.md (debug-endpoint).
    if (!res.ok) throw new Error(`GA4 Measurement Protocol: HTTP ${res.status}`);
    return true;
  } catch (e) {
    captureError(e, { scope: "ga4ServerPurchase", orderNumber: order.orderNumber });
    return false;
  }
}

/**
 * Fire-and-forget: op Vercel kan een losse promise sterven zodra de response
 * weg is, dus plannen we het via `after()` (draait ná de response, binnen de
 * functie-levensduur). Buiten een request-context (scripts) valt het terug op
 * een directe, niet-afgewachte aanroep.
 */
export function queueServerPurchase(order: ServerPurchaseOrder): void {
  if (!shouldSendServerPurchase(order)) return;
  try {
    after(() => sendServerPurchase(order));
  } catch {
    void sendServerPurchase(order);
  }
}
