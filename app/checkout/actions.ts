"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PaymentLineType, type PaymentMethod } from "@mollie/api-client";
import { getMollie, toMollieAmount, listEnabledMethods, type CheckoutMethod } from "@/lib/mollie";
import { computeOrder, generateOrderNumber, type CheckoutLineInput } from "@/lib/orders";
import { businessInfo } from "@/lib/business-info";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const customerSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().min(2).max(120),
  houseNumber: z.string().trim().min(1).max(12),
  city: z.string().trim().min(2).max(80),
  zipCode: z.string().trim().regex(/^\d{4}\s?[A-Za-z]{2}$/, "Ongeldige postcode"),
});

const checkoutSchema = z.object({
  customer: customerSchema,
  // Het bedrag dat de klant op het scherm zag — puur ter controle. De server
  // rekent zelf het echte totaal uit en weigert bij een verschil.
  expectedTotal: z.number().nonnegative().optional(),
  // Gekozen betaalmethode (Mollie method-id, bv. "ideal", "klarna"). Komt uit
  // getPaymentMethods(); Mollie valideert 'm alsnog bij het aanmaken.
  method: z.string().trim().regex(/^[a-z0-9_]+$/i).max(40).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantLabel: z.string().max(60).nullable().optional(),
        nachtkast: z.number().int().min(0).max(2).optional(),
        voetbank: z.number().int().min(0).max(1).optional(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
});

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

// Betaalmethoden die "achteraf betalen" zijn — deze eisen orderregels +
// factuuradres bij het aanmaken van de betaling.
const PAY_LATER = new Set(["klarna", "in3", "riverty", "billie", "klarnapaylater", "klarnapaynow", "klarnasliceit"]);

/**
 * Geeft de betaalmethoden voor het huidige winkelwagenbedrag. Client rendert
 * deze als keuze. Valt terug op een vaste basislijst als Mollie onbereikbaar is
 * (bv. lokaal zonder API-key) zodat de checkout-UI altijd werkt.
 */
export async function getPaymentMethods(amountValue: number): Promise<CheckoutMethod[]> {
  const amt = typeof amountValue === "number" && amountValue > 0 ? amountValue : 0;
  if (!amt) return [];
  const methods = await listEnabledMethods(amt, "NL");
  if (methods && methods.length) return methods;
  return [
    { id: "ideal", description: "iDEAL", image: null },
    { id: "creditcard", description: "Creditcard", image: null },
    { id: "bancontact", description: "Bancontact", image: null },
  ];
}

async function baseUrl(): Promise<string> {
  // Voorkeur: expliciete env-var (stabiel, canoniek). Anders leiden we het
  // domein af uit het request → lokaal = http://localhost:3000, productie =
  // je echte domein. Zo werkt afrekenen lokaal én live zonder extra config.
  const env = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (env) return env;
  // In productie NOOIT de (vervalsbare) x-forwarded-host / Host-header gebruiken
  // voor betaal-redirect/webhook — anders kan een gespoofte Host de betaling
  // omleiden. Val terug op de canonieke site-URL (constante).
  if (process.env.NODE_ENV === "production") return businessInfo.siteUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host");
  const proto = host?.includes("localhost") ? "http" : "https";
  return host ? `${proto}://${host}` : businessInfo.siteUrl.replace(/\/$/, "");
}

export async function createCheckout(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige gegevens" };
  }
  // Anti-flooding: elke call maakt een Order + live Mollie-betaling. Max 15
  // checkouts per 10 min per IP.
  const rl = await rateLimit(`checkout:ip:${await clientIp()}`, 15, 10 * 60 * 1000);
  if (!rl.ok) return { ok: false, error: "Te veel pogingen. Wacht even en probeer opnieuw." };

  const { customer, items, expectedTotal, method } = parsed.data;

  // Totaal SERVER-SIDE herberekenen uit de database.
  let computed;
  try {
    computed = await computeOrder(items as CheckoutLineInput[]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Kon bestelling niet berekenen" };
  }
  if (!(computed.total > 0)) return { ok: false, error: "Ongeldig bestelbedrag" };

  // Getoond bedrag = af te rekenen bedrag. Wijkt het server-totaal af van wat de
  // klant op het scherm zag (prijs gewijzigd sinds toevoegen), dan niet stil
  // doorbelasten maar weigeren zodat de klant het nieuwe bedrag kan bevestigen.
  if (
    typeof expectedTotal === "number" &&
    Math.round(expectedTotal * 100) !== Math.round(computed.subtotal * 100)
  ) {
    return {
      ok: false,
      error: "De prijs van een product is gewijzigd. Ververs je winkelwagen en controleer het nieuwe totaal.",
    };
  }

  // Order + regels opslaan (status open tot Mollie de betaling bevestigt).
  const orderNumber = generateOrderNumber(Date.now());
  const order = await prisma.order.create({
    data: {
      orderNumber,
      total: computed.total,
      shipping: computed.shipping,
      status: "open",
      ...customer,
      items: {
        create: computed.lines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          variantLabel: l.variantLabel,
          quantity: l.quantity,
          price: l.price,
        })),
      },
    },
  });

  // Mollie-betaling. Webhook alleen meegeven als de basis publiek (https,
  // geen localhost) is — Mollie weigert anders. Lokaal valt het terug op de
  // statuscontrole op de retourpagina.
  const base = await baseUrl();
  const webhookOk = base.startsWith("https://") && !base.includes("localhost") && !base.includes("127.0.0.1");

  // Achteraf-betalen (Klarna/in3) vereist orderregels + factuuradres. Alleen dán
  // meesturen — houdt de iDEAL/creditcard-flow simpel en robuust.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const useLines = !!method && PAY_LATER.has(method);
  const lines = useLines
    ? [
        ...computed.lines.map((l) => {
          const tot = round2(l.price * l.quantity);
          return {
            type: PaymentLineType.physical,
            description: l.variantLabel ? `${l.productName} — ${l.variantLabel}` : l.productName,
            quantity: l.quantity,
            unitPrice: toMollieAmount(l.price),
            totalAmount: toMollieAmount(tot),
            vatRate: "21.00",
            vatAmount: toMollieAmount(round2((tot * 21) / 121)),
          };
        }),
        ...(computed.shipping > 0
          ? [
              {
                type: PaymentLineType.shipping_fee,
                description: "Verzendkosten",
                quantity: 1,
                unitPrice: toMollieAmount(computed.shipping),
                totalAmount: toMollieAmount(computed.shipping),
                vatRate: "21.00",
                vatAmount: toMollieAmount(round2((computed.shipping * 21) / 121)),
              },
            ]
          : []),
      ]
    : undefined;
  const billingAddress = useLines
    ? {
        givenName: customer.firstName,
        familyName: customer.lastName,
        email: customer.email,
        streetAndNumber: `${customer.address} ${customer.houseNumber}`.trim(),
        postalCode: customer.zipCode.toUpperCase().replace(/\s+/g, " ").trim(),
        city: customer.city,
        country: "NL",
      }
    : undefined;

  try {
    const payment = await getMollie().payments.create({
      amount: toMollieAmount(computed.total),
      description: `Mokka Home — ${orderNumber}`,
      redirectUrl: `${base}/checkout/afgerond?order=${orderNumber}`,
      ...(webhookOk ? { webhookUrl: `${base}/api/webhooks/mollie` } : {}),
      metadata: { orderId: order.id, orderNumber },
      ...(method ? { method: method as PaymentMethod } : {}),
      ...(lines ? { lines } : {}),
      ...(billingAddress ? { billingAddress, shippingAddress: billingAddress } : {}),
    });
    await prisma.order.update({ where: { id: order.id }, data: { molliePaymentId: payment.id } });
    const url = payment.getCheckoutUrl();
    if (!url) return { ok: false, error: "Geen betaal-URL ontvangen van Mollie" };
    return { ok: true, url };
  } catch (e) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "failed" } }).catch(() => {});
    return { ok: false, error: e instanceof Error ? e.message : "Betaling starten mislukt" };
  }
}
