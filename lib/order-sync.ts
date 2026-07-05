import { prisma } from "@/lib/prisma";
import { getMollie } from "@/lib/mollie";

export type OrderStatus = "open" | "paid" | "failed" | "canceled" | "expired";

function mapStatus(mollieStatus: string): OrderStatus {
  switch (mollieStatus) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    default:
      return "open"; // open | pending | authorized
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

  // Overgang naar 'paid' atomair claimen: webhook én retourpagina roepen dit
  // vaak tegelijk aan. Alleen de invocatie waarvan de conditionele update
  // daadwerkelijk flipt (count===1) boekt de voorraad af — nooit dubbel.
  if (next === "paid") {
    const claim = await prisma.order.updateMany({
      where: { id: order.id, status: { not: "paid" } },
      data: { status: "paid" },
    });
    if (claim.count === 1) {
      await prisma.$transaction(
        order.items.map((it) =>
          prisma.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.quantity } } }),
        ),
      );
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
