"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMollie, toMollieAmount } from "@/lib/mollie";
import { computeOrder, generateOrderNumber, type CheckoutLineInput } from "@/lib/orders";
import { businessInfo } from "@/lib/business-info";

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
  const { customer, items, expectedTotal } = parsed.data;

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
  try {
    const payment = await getMollie().payments.create({
      amount: toMollieAmount(computed.total),
      description: `Mokka Home — ${orderNumber}`,
      redirectUrl: `${base}/checkout/afgerond?order=${orderNumber}`,
      ...(webhookOk ? { webhookUrl: `${base}/api/webhooks/mollie` } : {}),
      metadata: { orderId: order.id, orderNumber },
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
