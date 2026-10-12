"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PaymentLineType, type PaymentMethod } from "@mollie/api-client";
import { getMollie, toMollieAmountCents, listEnabledMethods, type CheckoutMethod } from "@/lib/mollie";
import { computeOrder, generateOrderNumber, generatePublicToken, type CheckoutLineInput } from "@/lib/orders";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { rateLimitIp } from "@/lib/rate-limit";
import { captureError } from "@/lib/sentry";

// ─── Validatie ──────────────────────────────────────────────────────

export type CheckoutCountry = "NL" | "BE";

const POSTCODE: Record<CheckoutCountry, RegExp> = {
  NL: /^\d{4}\s?[A-Za-z]{2}$/,
  BE: /^\d{4}$/,
};

const customerSchema = z
  .object({
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    email: z.string().trim().email().max(120),
    phone: z.string().trim().min(6).max(30),
    address: z.string().trim().min(2).max(120),
    houseNumber: z.string().trim().min(1).max(12),
    city: z.string().trim().min(2).max(80),
    zipCode: z.string().trim().min(4).max(10),
    // Verzendland. Default NL zodat de huidige checkout-UI (zonder landkeuze)
    // blijft werken; de UI stuurt "BE" mee zodra er een keuze is.
    country: z.enum(["NL", "BE"]).default("NL"),
  })
  .superRefine((c, ctx) => {
    if (!POSTCODE[c.country].test(c.zipCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["zipCode"],
        message: c.country === "BE" ? "Ongeldige postcode (4 cijfers)" : "Ongeldige postcode (bv. 1234 AB)",
      });
    }
  });

const checkoutSchema = z.object({
  customer: customerSchema,
  // Het bedrag dat de klant op het scherm zag (subtotaal excl. verzending) —
  // puur ter controle. De server rekent zelf het echte totaal uit.
  expectedTotal: z.number().nonnegative().optional(),
  // Gekozen betaalmethode (Mollie method-id, bv. "ideal", "klarna"). Komt uit
  // getPaymentMethods(); Mollie valideert 'm alsnog bij het aanmaken.
  method: z.string().trim().regex(/^[a-z0-9_]+$/i).max(40).optional(),
  // Google Ads click-id (verborgen formulierveld); anders uit de cookie.
  gclid: z.string().trim().regex(/^[A-Za-z0-9_-]{10,200}$/).optional(),
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

/**
 * Resultaat van createCheckout.
 * - ok:true → doorsturen naar `url` (Mollie).
 * - error:"PRICE_CHANGED" → het server-subtotaal wijkt af van wat de klant
 *   zag; toon `message`, ververs de winkelwagen (getCartSnapshot) en laat de
 *   klant het nieuwe `subtotal`/`total` bevestigen.
 * - overige fouten: `error` is een toonbare Nederlandse melding; `message`
 *   bevat dezelfde tekst zodat de UI altijd `message ?? error` kan tonen.
 */
export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: "PRICE_CHANGED"; message: string; subtotal: number; total: number }
  | { ok: false; error: string; message: string };

const fail = (error: string): CheckoutResult => ({ ok: false, error, message: error });

const phone = businessInfo.contact.phoneFormatted;
const PAYMENT_START_FAILED = `De betaling kon niet worden gestart. Probeer het opnieuw${phone ? ` of bel ons op ${phone}` : ""}.`;
const ORDER_SAVE_FAILED = `We konden je bestelling niet opslaan. Probeer het opnieuw${phone ? ` of bel ons op ${phone}` : ""}.`;

// Betaalmethoden die "achteraf betalen" zijn — deze eisen orderregels +
// factuuradres bij het aanmaken van de betaling.
const PAY_LATER = new Set(["klarna", "in3", "riverty", "billie", "klarnapaylater", "klarnapaynow", "klarnasliceit"]);

/**
 * Geeft de betaalmethoden voor het huidige winkelwagenbedrag en verzendland.
 * Client rendert deze als keuze. Valt terug op een vaste basislijst als Mollie
 * onbereikbaar is (bv. lokaal zonder API-key) zodat de checkout-UI altijd werkt.
 */
export async function getPaymentMethods(amountValue: number, country: CheckoutCountry = "NL"): Promise<CheckoutMethod[]> {
  const amt = typeof amountValue === "number" && amountValue > 0 ? amountValue : 0;
  if (!amt) return [];
  const safeCountry: CheckoutCountry = country === "BE" ? "BE" : "NL";
  const methods = await listEnabledMethods(amt, safeCountry);
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

/**
 * Google Ads click-id: uit het formulier, anders uit de cookie die de
 * conversion-linker zet (`_gcl_aw` = "GCL.<ts>.<gclid>") of een losse `gclid`.
 */
async function resolveGclid(fromForm: string | undefined): Promise<string | null> {
  if (fromForm) return fromForm;
  try {
    const jar = await cookies();
    const linker = jar.get("_gcl_aw")?.value;
    const candidate = linker ? linker.split(".").pop() : jar.get("gclid")?.value;
    return candidate && /^[A-Za-z0-9_-]{10,200}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

type OrderDraft = {
  customer: z.infer<typeof customerSchema>;
  computed: Awaited<ReturnType<typeof computeOrder>>;
  gclid: string | null;
};

/** Order + regels opslaan; bij een ordernummer-/token-botsing (P2002) één retry. */
async function createOrderRecord(draft: OrderDraft) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          publicToken: generatePublicToken(),
          total: draft.computed.total,
          shipping: draft.computed.shipping,
          status: "open",
          ...draft.customer,
          gclid: draft.gclid,
          items: {
            create: draft.computed.lines.map((l) => ({
              productId: l.productId,
              productName: l.productName,
              variantLabel: l.variantLabel,
              quantity: l.quantity,
              price: l.price,
            })),
          },
        },
      });
    } catch (e) {
      const unique = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (unique && attempt === 0) continue;
      throw e;
    }
  }
  throw new Error("createOrderRecord: onbereikbaar");
}

export async function createCheckout(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Ongeldige gegevens");
  }
  // Anti-flooding: elke call maakt een Order + live Mollie-betaling. Max 15
  // checkouts per 10 min per IP.
  const rl = await rateLimitIp("checkout", 15, 10 * 60 * 1000);
  if (!rl.ok) return fail("Te veel pogingen. Wacht even en probeer opnieuw.");

  const { customer, items, expectedTotal, method } = parsed.data;

  // Totaal SERVER-SIDE herberekenen uit de database (incl. verzendland).
  let computed;
  try {
    computed = await computeOrder(items as CheckoutLineInput[], customer.country);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Kon bestelling niet berekenen");
  }
  if (!(computed.totalCents > 0)) return fail("Ongeldig bestelbedrag");

  // Getoond bedrag = af te rekenen bedrag. Wijkt het server-subtotaal af van
  // wat de klant op het scherm zag (prijs gewijzigd sinds toevoegen), dan niet
  // stil doorbelasten maar weigeren zodat de klant het nieuwe bedrag bevestigt.
  if (typeof expectedTotal === "number" && Math.round(expectedTotal * 100) !== computed.subtotalCents) {
    return {
      ok: false,
      error: "PRICE_CHANGED",
      message: "De prijs van een product in je winkelwagen is gewijzigd. We hebben je winkelwagen bijgewerkt — controleer het nieuwe totaal en probeer opnieuw.",
      subtotal: computed.subtotal,
      total: computed.total,
    };
  }

  // Order + regels opslaan (status open tot Mollie de betaling bevestigt).
  let order;
  try {
    order = await createOrderRecord({ customer, computed, gclid: await resolveGclid(parsed.data.gclid) });
  } catch (e) {
    captureError(e, { scope: "createCheckout.order", items: items.length });
    return fail(ORDER_SAVE_FAILED);
  }
  const { orderNumber } = order;
  // publicToken is in het schema optioneel; wij zetten hem altijd bij create.
  const token = order.publicToken ?? "";

  // Mollie-betaling. Webhook alleen meegeven als de basis publiek (https,
  // geen localhost) is — Mollie weigert anders. Lokaal valt het terug op de
  // statuscontrole op de retourpagina + de reconcile-cron.
  const base = await baseUrl();
  const webhookOk = base.startsWith("https://") && !base.includes("localhost") && !base.includes("127.0.0.1");

  // Achteraf-betalen (Klarna/in3) vereist orderregels + factuuradres. Alleen dán
  // meesturen — houdt de iDEAL/creditcard-flow simpel en robuust. Alle
  // bedragen uit centen zodat de regels exact optellen tot het totaal.
  const vatRate = shippingInfo.vatRatePercent.toFixed(2);
  const useLines = !!method && PAY_LATER.has(method);
  const lines = useLines
    ? [
        ...computed.lines.map((l) => ({
          type: PaymentLineType.physical,
          description: l.variantLabel ? `${l.productName} — ${l.variantLabel}` : l.productName,
          quantity: l.quantity,
          unitPrice: toMollieAmountCents(l.unitCents),
          totalAmount: toMollieAmountCents(l.totalCents),
          vatRate,
          vatAmount: toMollieAmountCents(l.vatCents),
        })),
        ...(computed.shippingCents > 0
          ? [
              {
                type: PaymentLineType.shipping_fee,
                description: "Verzendkosten",
                quantity: 1,
                unitPrice: toMollieAmountCents(computed.shippingCents),
                totalAmount: toMollieAmountCents(computed.shippingCents),
                vatRate,
                vatAmount: toMollieAmountCents(computed.vatCents - computed.lines.reduce((s, l) => s + l.vatCents, 0)),
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
        country: customer.country,
      }
    : undefined;

  let payment;
  try {
    payment = await getMollie().payments.create({
      amount: toMollieAmountCents(computed.totalCents),
      description: `${businessInfo.name} — ${orderNumber}`,
      redirectUrl: `${base}/checkout/afgerond?t=${token}`,
      ...(webhookOk ? { webhookUrl: `${base}/api/webhooks/mollie` } : {}),
      metadata: { orderId: order.id, orderNumber },
      ...(method ? { method: method as PaymentMethod } : {}),
      ...(lines ? { lines } : {}),
      ...(billingAddress ? { billingAddress, shippingAddress: billingAddress } : {}),
    });
  } catch (e) {
    // Alléén een mislukte Mollie-aanmaak betekent "betaling mislukt". De ruwe
    // Mollie-melding gaat naar Sentry, nooit naar de klant.
    captureError(e, { scope: "createCheckout.mollie", orderNumber, method: method ?? null, country: customer.country });
    await markFailed(order.id, orderNumber);
    return fail(PAYMENT_START_FAILED);
  }

  // De betaling bestaat nu bij Mollie. Mislukt het opslaan van het payment-id
  // door een DB-hik, dan de order NIET als 'failed' markeren — de webhook synct
  // alsnog via metadata.orderId. Wel melden: zonder id kan de bedankpagina en
  // de reconcile-cron deze order niet zelf controleren.
  try {
    await prisma.order.update({ where: { id: order.id }, data: { molliePaymentId: payment.id } });
  } catch (e) {
    captureError(e, { scope: "createCheckout.savePaymentId", orderNumber, paymentId: payment.id });
  }

  const url = payment.getCheckoutUrl();
  if (!url) {
    captureError(new Error("Mollie gaf geen checkout-URL"), { scope: "createCheckout.noUrl", orderNumber, paymentId: payment.id });
    await markFailed(order.id, orderNumber);
    return fail(PAYMENT_START_FAILED);
  }
  return { ok: true, url };
}

async function markFailed(orderId: string, orderNumber: string): Promise<void> {
  try {
    await prisma.order.updateMany({ where: { id: orderId, status: "open" }, data: { status: "failed" } });
  } catch (e) {
    captureError(e, { scope: "createCheckout.markFailed", orderNumber });
  }
}
