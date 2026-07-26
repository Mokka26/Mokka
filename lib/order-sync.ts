import { prisma } from "@/lib/prisma";
import { getMollie } from "@/lib/mollie";

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

/**
 * Haalt de betaling op bij Mollie en synchroniseert de order-status. Idempotent
 * (kan veilig meerdere keren — webhook én retourpagina roepen dit aan). Verlaagt
 * de voorraad eenmalig bij de overgang naar 'paid'.
 */
export async function syncOrderByPaymentId(paymentId: string): Promise<OrderStatus | null> {
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

  // Overgang naar 'paid' atomair claimen: webhook én retourpagina roepen dit
  // vaak tegelijk aan. Alleen de invocatie waarvan de conditionele update
  // daadwerkelijk flipt (count===1) boekt de voorraad af — nooit dubbel.
  if (next === "paid") {
    const claim = await prisma.order.updateMany({
      where: { id: order.id, status: { not: "paid" } },
      data: { status: "paid" },
    });
    if (claim.count === 1) {
      // Afboeken met ondergrens: alleen decrement als er genoeg voorraad is,
      // anders klemmen op 0 — nooit negatief. (Race op het laatste stuk: de
      // order is dan al betaald; voorraad 0 signaleert de opvolging.)
      for (const it of order.items) {
        const dec = await prisma.product.updateMany({
          where: { id: it.productId, stock: { gte: it.quantity } },
          data: { stock: { decrement: it.quantity } },
        });
        if (dec.count === 0) {
          await prisma.product.updateMany({ where: { id: it.productId }, data: { stock: 0 } }).catch(() => {});
        }
      }
    }
    return "paid";
  }

  // Niet-betaalde overgangen (failed/canceled/expired) hebben geen eenmalig
  // neveneffect → een simpele set is idempotent genoeg.
  await prisma.order.update({ where: { id: order.id }, data: { status: next } });
  return next;
}

/** Voor de retourpagina: sync op ordernummer en geef de verse order terug. */
export async function syncOrderByNumber(orderNumber: string) {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return null;
  if (order.molliePaymentId) {
    try {
      await syncOrderByPaymentId(order.molliePaymentId);
    } catch {
      // Mollie even niet bereikbaar → toon de laatst bekende status.
    }
  }
  return prisma.order.findUnique({
    where: { orderNumber },
    select: { orderNumber: true, status: true, total: true, firstName: true, email: true },
  });
}
