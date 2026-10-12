import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMollie } from "@/lib/mollie";
import { sendOrderConfirmation } from "@/lib/email";
import { captureError, captureWarning } from "@/lib/sentry";
import { revalidateProduct } from "@/lib/revalidate";
import { queueServerPurchase } from "@/lib/analytics-server";

export type OrderStatus = "open" | "paid" | "failed" | "canceled" | "expired";

function mapStatus(mollieStatus: string): OrderStatus {
  switch (mollieStatus) {
    case "paid":
    // Achteraf-betalen (Klarna, in3, Riverty) bevestigt eerst als 'authorized':
    // de betaling is gegarandeerd aan de merchant (Mollie/aanbieder int later
    // bij de klant) en wordt automatisch gecaptured. Voor onze order = verkocht,
    // dus behandelen als betaald → winkelwagen legen + voorraad afboeken.
    case "authorized":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    default:
      return "open"; // open | pending
  }
}

type SyncOptions = {
  /**
   * PDP's/categorie-pagina's zijn ISR (1 uur). Na een voorraadafboeking
   * verversen we ze, maar dat mag alleen vanuit een route handler/server
   * action/cron — NIET tijdens het renderen van een pagina (de bedankpagina
   * zet dit op false; de webhook en cron verversen alsnog).
   */
  revalidate?: boolean;
};

/**
 * Haalt de betaling op bij Mollie en synchroniseert de order-status. Idempotent
 * (kan veilig meerdere keren — webhook, retourpagina én reconcile-cron roepen
 * dit aan). Boekt de voorraad eenmalig af bij de overgang naar 'paid', in één
 * transactie met de status-claim, en verstuurt daarna de bevestiging.
 *
 * Gooit bij Mollie-/DB-fouten (de webhook antwoordt dan 500 → Mollie retry't).
 * Retourneert null als de betaling geen (bekende) order heeft.
 */
export async function syncOrderByPaymentId(paymentId: string, opts: SyncOptions = {}): Promise<OrderStatus | null> {
  const payment = await getMollie().payments.get(paymentId);
  const orderId = (payment.metadata as { orderId?: string } | null)?.orderId;
  if (!orderId) return null;

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return null;

  const next = mapStatus(payment.status);
  if (order.status === next) return next;

  // Eenmaal betaald = betaald: nooit terug-downgraden (bv. een authorized
  // Klarna-betaling die later canceled meldt). Voorraad is al afgeboekt;
  // terugdraaien vergt handmatige opvolging, geen stille status-flip.
  if (order.status === "paid") return "paid";

  if (next !== "paid") {
    // Niet-betaalde overgangen (failed/canceled/expired) hebben geen eenmalig
    // neveneffect → een conditionele set (nooit over 'paid' heen) is idempotent.
    await prisma.order.updateMany({ where: { id: order.id, status: { not: "paid" } }, data: { status: next } });
    return next;
  }

  const paidAt = new Date(payment.paidAt ?? payment.authorizedAt ?? Date.now());
  const paymentMethod = typeof payment.method === "string" ? payment.method : null;

  // Overgang naar 'paid' + voorraadafboeking in ÉÉN transactie. Webhook én
  // retourpagina roepen dit vaak tegelijk aan: alleen de invocatie waarvan de
  // conditionele update daadwerkelijk flipt (count===1) boekt af — nooit dubbel.
  // Breekt de run af, dan rolt alles terug en herstelt de volgende sync het.
  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: order.id, status: { not: "paid" } },
      data: { status: "paid", paidAt, paymentMethod },
    });
    if (claim.count !== 1) return { claimed: false as const, oversold: [] as string[] };

    const oversold: string[] = [];
    for (const it of order.items) {
      // Afboeken met ondergrens: alleen decrement als er genoeg voorraad is,
      // anders klemmen op 0 — nooit negatief. De order is dan al betaald;
      // dat is overselling en wordt hieronder gemeld voor handmatige opvolging.
      const dec = await tx.product.updateMany({
        where: { id: it.productId, stock: { gte: it.quantity } },
        data: { stock: { decrement: it.quantity } },
      });
      if (dec.count === 0) {
        await tx.product.updateMany({ where: { id: it.productId }, data: { stock: 0 } });
        oversold.push(it.productId);
      }
    }
    return { claimed: true as const, oversold };
  });

  if (!result.claimed) return "paid";

  for (const productId of result.oversold) {
    captureWarning("Overselling: order betaald maar voorraad was al (bijna) 0", {
      orderNumber: order.orderNumber,
      productId,
    });
  }

  if (opts.revalidate !== false) await revalidateStockPages(order.items.map((i) => i.productId));

  // Server-side GA4-purchase (Measurement Protocol) — zelfde voorwaarde als de
  // bevestigingsmail: alleen de claimende invocatie komt hier, dus precies één
  // keer per order. Fire-and-forget; fouten gaan naar Sentry, nooit naar de
  // klant. Bewust NIET gekoppeld aan confirmationSentAt/resend: een mislukte
  // mail mag geen tweede conversie opleveren.
  queueServerPurchase({ ...order, paidAt, paymentMethod });

  // Bevestiging NA de transactie — precies één keer (alleen de claimende
  // invocatie komt hier). Mislukt de mail, dan blijft confirmationSentAt null
  // en probeert resendPendingConfirmations() het later opnieuw.
  await sendConfirmationAndMark({ ...order, status: "paid", paidAt, paymentMethod });
  return "paid";
}

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

async function sendConfirmationAndMark(order: OrderWithItems): Promise<boolean> {
  try {
    const sent = await sendOrderConfirmation(order);
    if (!sent) return false;
    await prisma.order.update({ where: { id: order.id }, data: { confirmationSentAt: new Date() } });
    return true;
  } catch (e) {
    captureError(e, { scope: "orderConfirmation", orderNumber: order.orderNumber });
    return false;
  }
}

async function revalidateStockPages(productIds: string[]): Promise<void> {
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(productIds)] } },
      select: { slug: true, category: true },
    });
    for (const p of products) revalidateProduct(p);
  } catch (e) {
    captureError(e, { scope: "revalidateStockPages", productIds });
  }
}

// ─── Retourpagina ──────────────────────────────────────────────────

export type ReturnOrderView = {
  orderNumber: string;
  status: string;
  total: number;
  firstName: string;
  email: string;
};

/**
 * Voor de bedankpagina. Zoekt de order op publicToken (voorkeur) of
 * ordernummer (legacy-redirects van vóór de token). Synct alleen als de order
 * nog niet betaald is én de aanroeper dat toestaat (rate-limit zit bij de
 * pagina). Mollie-fouten breken de pagina niet: toon de laatst bekende status.
 */
export async function getOrderForReturnPage(
  where: { publicToken: string } | { orderNumber: string },
  opts: { allowSync: boolean },
): Promise<ReturnOrderView | null> {
  const select = { orderNumber: true, status: true, total: true, firstName: true, email: true, molliePaymentId: true } as const;
  const order = await prisma.order.findUnique({ where, select });
  if (!order) return null;
  if (order.status === "paid" || !order.molliePaymentId || !opts.allowSync) return order;
  try {
    await syncOrderByPaymentId(order.molliePaymentId, { revalidate: false });
  } catch (e) {
    captureError(e, { scope: "returnPageSync", orderNumber: order.orderNumber });
    return order;
  }
  return (await prisma.order.findUnique({ where, select })) ?? order;
}

// ─── Reconcile (cron) ──────────────────────────────────────────────

export type ReconcileResult = { checked: number; updated: number; expiredWithoutPayment: number; errors: number };

/**
 * Vangnet voor gemiste webhooks: synct open orders mét Mollie-betaling die
 * ouder zijn dan `olderThanMinutes`, en zet open orders ZONDER betaling
 * (Mollie-aanmaak mislukt vóór het payment-id werd opgeslagen) na 24 uur op
 * 'expired' zodat ze niet eeuwig 'in behandeling' blijven.
 */
export async function reconcileOpenOrders(olderThanMinutes: number): Promise<ReconcileResult> {
  const result: ReconcileResult = { checked: 0, updated: 0, expiredWithoutPayment: 0, errors: 0 };
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const open = await prisma.order.findMany({
    where: { status: "open", molliePaymentId: { not: null }, createdAt: { lt: cutoff } },
    select: { id: true, orderNumber: true, molliePaymentId: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  for (const o of open) {
    result.checked += 1;
    try {
      const status = await syncOrderByPaymentId(o.molliePaymentId!);
      if (status && status !== "open") result.updated += 1;
    } catch (e) {
      result.errors += 1;
      captureError(e, { scope: "reconcileOpenOrders", orderNumber: o.orderNumber });
    }
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const expired = await prisma.order.updateMany({
    where: { status: "open", molliePaymentId: null, createdAt: { lt: dayAgo } },
    data: { status: "expired" },
  });
  result.expiredWithoutPayment = expired.count;
  return result;
}

/**
 * Verstuurt alsnog de bevestiging voor betaalde orders zonder
 * confirmationSentAt (SMTP was even stuk, of de run brak af na de transactie).
 * Max 20 per run. Alleen orders die ná de invoering van paidAt betaald zijn en
 * hooguit 7 dagen oud — oudere/legacy-orders kregen hun mail al via het oude pad.
 */
export async function resendPendingConfirmations(): Promise<{ attempted: number; sent: number }> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { status: "paid", confirmationSentAt: null, paidAt: { gte: weekAgo } },
    include: { items: true },
    orderBy: { paidAt: "asc" },
    take: 20,
  });
  let sent = 0;
  for (const order of orders) {
    if (await sendConfirmationAndMark(order)) sent += 1;
  }
  return { attempted: orders.length, sent };
}
