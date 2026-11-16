import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMollie, isMollieNotFound } from "@/lib/mollie";
import { sendOrderConfirmation } from "@/lib/email";
import { captureError, captureWarning } from "@/lib/sentry";
import { revalidateProduct } from "@/lib/revalidate";
import { queueServerPurchase } from "@/lib/analytics-server";
import { toCents } from "@/lib/money";

export type OrderStatus =
  | "open"
  | "paid"
  | "failed"
  | "canceled"
  | "expired"
  // Betaald, daarna (deels) terugbetaald of teruggeboekt (chargeback) in Mollie.
  | "partially_refunded"
  | "refunded"
  // Betaling past niet bij de order (bedrag/valuta/payment-id): handmatig
  // controleren. Valt buiten de reconcile-cron.
  | "review";

/** Statussen waarin de order als verkocht geldt (voorraad is afgeboekt). */
const PAID_LIKE: ReadonlySet<string> = new Set(["paid", "partially_refunded", "refunded"]);

/**
 * PDP's en categoriepagina's zijn ISR met 1 uur revalidate: binnen dat venster
 * na de betaling heeft een (extra) revalidatie zin, daarna niet meer.
 */
const REVALIDATE_WINDOW_MS = 60 * 60 * 1000;

type MollieAmountLike = { value?: string; currency?: string } | null | undefined;

/**
 * Terugbetaalstatus volgens Mollie: som van terugbetaald + teruggeboekt
 * (chargeback) t.o.v. het ordertotaal. null = niets terugbetaald.
 */
export function refundStatusOf(
  orderTotal: number,
  payment: { amountRefunded?: MollieAmountLike; amountChargedBack?: MollieAmountLike },
): "refunded" | "partially_refunded" | null {
  const cents = (a: MollieAmountLike) => {
    const n = Number(a?.value ?? 0);
    return Number.isFinite(n) && n > 0 ? toCents(n) : 0;
  };
  const back = cents(payment.amountRefunded) + cents(payment.amountChargedBack);
  if (back <= 0) return null;
  return back >= toCents(orderTotal) ? "refunded" : "partially_refunded";
}

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

/**
 * Reden waarom een Mollie-betaling niet bij de order past, of null als alles
 * klopt. Ontbreekt het bedrag in de respons, dan wordt het niet geblokkeerd.
 */
export function paymentMismatch(
  order: { total: number; molliePaymentId: string | null },
  paymentId: string,
  amount: { value?: string; currency?: string } | null | undefined,
): string | null {
  if (order.molliePaymentId && order.molliePaymentId !== paymentId) return "ander payment-id";
  if (!amount?.value) return null;
  if (amount.currency && amount.currency !== "EUR") return `valuta ${amount.currency}`;
  const paidCents = toCents(Number(amount.value));
  const totalCents = toCents(order.total);
  if (!Number.isFinite(paidCents) || paidCents !== totalCents) return `bedrag ${amount.value} ≠ ${order.total}`;
  return null;
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
  const refund = refundStatusOf(order.total, payment);

  // Terugbetaling of chargeback op een betaalde order: status volgen, de
  // eigenaar waarschuwen. Voorraad wordt NIET automatisch teruggeboekt (het
  // product kan beschadigd of nooit verstuurd zijn) — dat blijft handwerk.
  if (PAID_LIKE.has(order.status)) {
    const target: OrderStatus = refund ?? "paid";
    if (order.status !== target) {
      await prisma.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: target } });
      if (refund) {
        captureWarning("Terugbetaling/chargeback in Mollie verwerkt (voorraad niet teruggeboekt)", {
          orderNumber: order.orderNumber,
          status: target,
        });
      }
    } else if (target === "paid" && opts.revalidate !== false && paidRecently(order.paidAt)) {
      // De bedankpagina claimde 'paid' al (zonder te mogen revalideren): de
      // webhook ververst de voorraad op PDP/categorie alsnog.
      await revalidateStockPages(order.items.map((i) => i.productId));
    }
    // Eenmaal betaald = betaald: nooit terug-downgraden naar open/failed/
    // canceled (bv. een authorized Klarna-betaling die later canceled meldt).
    return target;
  }

  if (order.status === next) return next;

  if (next !== "paid") {
    // Niet-betaalde overgangen (failed/canceled/expired) hebben geen eenmalig
    // neveneffect → een conditionele set (nooit over 'paid' heen) is idempotent.
    await prisma.order.updateMany({ where: { id: order.id, status: { not: "paid" } }, data: { status: next } });
    return next;
  }

  // Extra zekerheid: de betaling moet bij déze order horen en het volle bedrag
  // dekken. Betalingen worden server-side aangemaakt, dus een verschil wijst op
  // een fout of manipulatie → niet als betaald boeken, wel melden.
  const mismatch = paymentMismatch(order, paymentId, payment.amount);
  if (mismatch) {
    captureError(new Error(`Betaling past niet bij order: ${mismatch}`), {
      scope: "orderSync.paymentMismatch",
      orderNumber: order.orderNumber,
    });
    // Apart markeren: blijft zichtbaar voor de admin, maar verstopt de
    // reconcile-cron niet meer (die pakt alleen 'open').
    await prisma.order.updateMany({ where: { id: order.id, status: "open" }, data: { status: "review" } });
    return "review";
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

  if (!result.claimed) {
    // Een andere aanroep (meestal de bedankpagina, zonder revalidatie) won de
    // claim: de webhook/cron ververst de pagina's dan alsnog.
    if (opts.revalidate !== false) await revalidateStockPages(order.items.map((i) => i.productId));
    return "paid";
  }

  for (const productId of result.oversold) {
    captureWarning("Overselling: order betaald maar voorraad was al (bijna) 0", {
      orderNumber: order.orderNumber,
      productId,
    });
  }

  if (opts.revalidate !== false) await revalidateStockPages(order.items.map((i) => i.productId));

  // Server-side GA4-purchase (Measurement Protocol) — zelfde voorwaarde als de
  // bevestigingsmail: alleen de claimende invocatie komt hier, dus precies één
  // keer per order. Uitsluitend met cookie-akkoord van de klant
  // (Order.analyticsConsent); zonder akkoord geen event. Fire-and-forget;
  // fouten gaan naar Sentry, nooit naar de klant. Bewust NIET gekoppeld aan
  // confirmationSentAt/resend: een mislukte mail mag geen tweede conversie
  // opleveren.
  if (order.analyticsConsent === true) queueServerPurchase({ ...order, paidAt, paymentMethod });

  // Bevestiging NA de transactie — precies één keer (alleen de claimende
  // invocatie komt hier). Mislukt de mail, dan gaat confirmationSentAt terug
  // naar null en probeert resendPendingConfirmations() het later opnieuw.
  await claimAndSendConfirmation({ ...order, status: "paid", paidAt, paymentMethod });

  // Gemiste webhook en intussen al (deels) terugbetaald: meteen volgen.
  if (refund) {
    await prisma.order.updateMany({ where: { id: order.id, status: "paid" }, data: { status: refund } });
    captureWarning("Terugbetaling/chargeback in Mollie verwerkt (voorraad niet teruggeboekt)", { orderNumber: order.orderNumber, status: refund });
    return refund;
  }
  return "paid";
}

function paidRecently(paidAt: Date | null, now = Date.now()): boolean {
  return paidAt instanceof Date && now - paidAt.getTime() < REVALIDATE_WINDOW_MS;
}

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

/**
 * Verstuurt de bevestiging precies één keer: eerst een atomaire claim op
 * confirmationSentAt (alleen de aanroep die de kolom van null naar nu flipt,
 * count === 1, mailt), dan de mail. Mislukt de mail, dan wordt de claim
 * teruggedraaid zodat de reconcile-cron het later opnieuw probeert.
 */
async function claimAndSendConfirmation(order: OrderWithItems): Promise<boolean> {
  let claimed = false;
  try {
    const claim = await prisma.order.updateMany({
      where: { id: order.id, confirmationSentAt: null },
      data: { confirmationSentAt: new Date() },
    });
    if (claim.count !== 1) return false;
    claimed = true;
    const sent = await sendOrderConfirmation(order);
    if (sent) return true;
    await releaseConfirmationClaim(order.id);
    return false;
  } catch (e) {
    captureError(e, { scope: "orderConfirmation", orderNumber: order.orderNumber });
    if (claimed) await releaseConfirmationClaim(order.id);
    return false;
  }
}

async function releaseConfirmationClaim(orderId: string): Promise<void> {
  try {
    await prisma.order.updateMany({ where: { id: orderId }, data: { confirmationSentAt: null } });
  } catch (e) {
    captureError(e, { scope: "orderConfirmation.release", orderId });
  }
}

async function revalidateStockPages(productIds: string[]): Promise<void> {
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(productIds)] } },
      select: { slug: true, category: true },
    });
    // Webhook/cron: geen Server Action, dus de tag direct laten vervallen via
    // revalidateTag(…, { expire: 0 }) i.p.v. updateTag.
    for (const p of products) revalidateProduct(p, undefined, { mode: "background" });
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
  createdAt: Date;
};

/** Zo lang geeft de publieke token van de bedankpagina toegang tot de orderdetails. */
export const PUBLIC_TOKEN_TTL_DAYS = 30;

export function isPublicTokenFresh(createdAt: Date | null | undefined, now = Date.now()): boolean {
  if (!(createdAt instanceof Date)) return false;
  return now - createdAt.getTime() <= PUBLIC_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
}

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
  const select = { orderNumber: true, status: true, total: true, firstName: true, email: true, molliePaymentId: true, createdAt: true } as const;
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

export type ReconcileResult = { checked: number; updated: number; expiredWithoutPayment: number; notFound: number; errors: number };

/** Orders ouder dan dit neemt de cron niet meer mee (Mollie-betalingen verlopen ruim eerder). */
const RECONCILE_MAX_AGE_DAYS = 30;

/**
 * Vangnet voor gemiste webhooks: synct open orders mét Mollie-betaling die
 * ouder zijn dan `olderThanMinutes` (en hooguit 30 dagen oud), en zet open
 * orders ZONDER betaling (Mollie-aanmaak mislukt vóór het payment-id werd
 * opgeslagen) na 24 uur op 'expired' zodat ze niet eeuwig 'in behandeling'
 * blijven. Kent Mollie de betaling niet (404, bv. een testbetaling met een
 * andere API-key), dan gaat de order ook op 'expired' — anders blijft hij
 * vooraan in de selectie staan en verstopt hij de cron.
 */
export async function reconcileOpenOrders(olderThanMinutes: number): Promise<ReconcileResult> {
  const result: ReconcileResult = { checked: 0, updated: 0, expiredWithoutPayment: 0, notFound: 0, errors: 0 };
  const now = Date.now();
  const cutoff = new Date(now - olderThanMinutes * 60 * 1000);
  const oldest = new Date(now - RECONCILE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  const open = await prisma.order.findMany({
    where: { status: "open", molliePaymentId: { not: null }, createdAt: { lt: cutoff, gte: oldest } },
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
      if (isMollieNotFound(e)) {
        await prisma.order.updateMany({ where: { id: o.id, status: "open" }, data: { status: "expired" } });
        result.notFound += 1;
        captureWarning("Reconcile: Mollie kent de betaling niet (404), order op expired", { orderNumber: o.orderNumber });
        continue;
      }
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

/** Pas na deze wachttijd neemt de cron een order over van de live sync (die is dan zeker klaar). */
const RESEND_GRACE_MS = 10 * 60 * 1000;

/**
 * Verstuurt alsnog de bevestiging voor betaalde orders zonder
 * confirmationSentAt (SMTP was even stuk, of de run brak af na de transactie).
 * Max 20 per run. Alleen orders die minstens 10 minuten geleden betaald zijn
 * (zodat de webhook/retourpagina-sync niet tegelijk dezelfde mail stuurt) en
 * hooguit 7 dagen oud — oudere/legacy-orders kregen hun mail al via het oude
 * pad. De claim op confirmationSentAt is atomair: één mail per order.
 */
export async function resendPendingConfirmations(): Promise<{ attempted: number; sent: number }> {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const graceCutoff = new Date(now - RESEND_GRACE_MS);
  const orders = await prisma.order.findMany({
    where: { status: "paid", confirmationSentAt: null, paidAt: { gte: weekAgo, lt: graceCutoff } },
    include: { items: true },
    orderBy: { paidAt: "asc" },
    take: 20,
  });
  let sent = 0;
  for (const order of orders) {
    if (await claimAndSendConfirmation(order)) sent += 1;
  }
  return { attempted: orders.length, sent };
}
