import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { csvResponse, isoDate, toCsv } from "@/app/admin/(protected)/_lib/csv";
import { orderListWhere, parseOrderListParams } from "@/app/admin/(protected)/_lib/order-filters";
import { fulfillmentLabel, orderStatusLabel, paymentMethodLabel } from "@/app/admin/(protected)/_lib/order-status";

export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;
const dt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Amsterdam" });

/** CSV-export van bestellingen met exact dezelfde filters als de admin-lijst. */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return new Response("Niet ingelogd", { status: 401 });

  const params = parseOrderListParams(new URL(req.url).searchParams);
  const orders = await prisma.order.findMany({
    where: orderListWhere(params),
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      orderNumber: true,
      createdAt: true,
      status: true,
      fulfillmentStatus: true,
      firstName: true,
      lastName: true,
      email: true,
      total: true,
      paymentMethod: true,
    },
  });

  const csv = toCsv(
    ["Ordernummer", "Datum", "Status", "Afhandeling", "Naam", "E-mail", "Totaal", "Betaalmethode"],
    orders.map((o) => [
      o.orderNumber,
      dt.format(o.createdAt),
      orderStatusLabel(o.status),
      fulfillmentLabel(o.fulfillmentStatus),
      `${o.firstName} ${o.lastName}`.trim(),
      o.email,
      o.total.toFixed(2).replace(".", ","),
      paymentMethodLabel(o.paymentMethod),
    ]),
  );

  return csvResponse(`bestellingen-${isoDate()}.csv`, csv);
}
