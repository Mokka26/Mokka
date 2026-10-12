import Link from "next/link";
import { Download, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/components/ui/price";
import { Pagination } from "@/components/admin/Pagination";
import { FulfillmentBadge, OrderStatusBadge } from "@/components/admin/StatusBadge";
import DeleteOrderButton from "./DeleteOrderButton";
import {
  ORDER_PAGE_SIZE,
  ORDER_PERIODS,
  ORDER_PERIOD_LABEL,
  orderListHref,
  orderListQuery,
  orderListWhere,
  parseOrderListParams,
} from "../_lib/order-filters";
import {
  FULFILLMENT_LABEL,
  FULFILLMENT_STATUSES,
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  paymentMethodLabel,
} from "../_lib/order-status";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" });

const selectCls =
  "w-full min-h-11 px-3 py-2 bg-white border border-line text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent";
const labelCls = "block text-[10px] uppercase tracking-[0.25em] text-stone mb-1.5";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseOrderListParams(await searchParams);
  const where = orderListWhere(params);

  const [total, paidAgg, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({
      where: { AND: [where, { status: "paid" }] },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * ORDER_PAGE_SIZE,
      take: ORDER_PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        fulfillmentStatus: true,
        paymentMethod: true,
        total: true,
        firstName: true,
        lastName: true,
        email: true,
        city: true,
        country: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  const paidCount = paidAgg._count._all;
  const revenue = paidAgg._sum.total ?? 0;
  const exportHref = `/api/admin/orders/export${orderListQuery(params) ? `?${orderListQuery(params)}` : ""}`;
  const hasFilter =
    params.status || params.fulfillment || params.period !== "all" || params.q || params.from || params.to;

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-2">Verkoop</p>
          <h1 className="font-serif text-4xl text-ink leading-none">Bestellingen</h1>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 text-[11px] uppercase tracking-[0.25em] border border-line text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </a>
      </header>

      {/* Kopcijfers voor de huidige filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Bestellingen" value={String(total)} />
        <Stat label="Betaald" value={String(paidCount)} />
        <Stat label="Omzet (betaald)" value={formatPrice(revenue)} />
      </div>

      {/* Snelfilters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link
          href={orderListHref({ ...params, status: "paid", page: 1 })}
          className={`inline-flex items-center min-h-11 px-4 text-[11px] uppercase tracking-[0.2em] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            params.status === "paid" ? "bg-success text-white border-success" : "bg-success/10 text-success border-success/30 hover:bg-success/20"
          }`}
        >
          Betaald
        </Link>
        <Link
          href={orderListHref({ ...params, fulfillment: "pending", status: "paid", page: 1 })}
          className={`inline-flex items-center min-h-11 px-4 text-[11px] uppercase tracking-[0.2em] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            params.fulfillment === "pending" && params.status === "paid"
              ? "bg-ink text-white border-ink"
              : "bg-white text-ink border-line hover:border-accent"
          }`}
        >
          Te verwerken
        </Link>
        {hasFilter && (
          <Link
            href="/admin/orders"
            className="inline-flex items-center min-h-11 px-4 text-[11px] uppercase tracking-[0.2em] text-stone hover:text-ink underline-offset-4 hover:underline"
          >
            Filters wissen
          </Link>
        )}
      </div>

      {/* Filterformulier (GET — werkt zonder JS) */}
      <form method="get" action="/admin/orders" className="bg-white border border-line p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="f-status" className={labelCls}>Betaalstatus</label>
            <select id="f-status" name="status" defaultValue={params.status ?? ""} className={selectCls}>
              <option value="">Alle</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-fulfillment" className={labelCls}>Afhandeling</label>
            <select id="f-fulfillment" name="fulfillment" defaultValue={params.fulfillment ?? ""} className={selectCls}>
              <option value="">Alle</option>
              {FULFILLMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{FULFILLMENT_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-period" className={labelCls}>Periode</label>
            <select id="f-period" name="period" defaultValue={params.period} className={selectCls}>
              {ORDER_PERIODS.map((p) => (
                <option key={p} value={p}>{ORDER_PERIOD_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-q" className={labelCls}>Zoeken</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone pointer-events-none" />
              <input
                id="f-q"
                name="q"
                type="search"
                defaultValue={params.q ?? ""}
                placeholder="Ordernummer, naam of e-mail"
                className={`${selectCls} pl-10`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="f-from" className={labelCls}>Van (datum)</label>
            <input id="f-from" name="from" type="date" defaultValue={params.from ?? ""} className={selectCls} />
          </div>
          <div>
            <label htmlFor="f-to" className={labelCls}>Tot en met (datum)</label>
            <input id="f-to" name="to" type="date" defaultValue={params.to ?? ""} className={selectCls} />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full sm:w-auto min-h-11 bg-ink text-white px-6 py-2.5 text-[11px] uppercase tracking-[0.25em] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors"
            >
              Filteren
            </button>
          </div>
        </div>
        <p className="text-sm text-stone mt-3">
          Een van/tot-datum gaat vóór de periode-keuze. Datums zijn Nederlandse tijd.
        </p>
      </form>

      {orders.length === 0 ? (
        <div className="bg-white border border-line p-12 text-center">
          <p className="font-serif text-2xl text-ink mb-2">
            {hasFilter ? "Geen bestellingen voor dit filter" : "Nog geen bestellingen"}
          </p>
          <p className="text-base text-stone">
            {hasFilter ? "Pas het filter aan of wis het." : "Zodra een klant afrekent verschijnt de bestelling hier."}
          </p>
        </div>
      ) : (
        <ul className="bg-white border border-line divide-y divide-line">
          {orders.map((o) => (
            <li key={o.id} className="px-4 sm:px-5 py-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] gap-x-6 gap-y-2 md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-serif text-lg text-ink tabular-nums hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {o.orderNumber}
                      </Link>
                      <OrderStatusBadge status={o.status} />
                      <FulfillmentBadge status={o.fulfillmentStatus} />
                    </div>
                    <p className="text-sm text-stone">
                      {dt.format(o.createdAt)} · {o._count.items} artikel{o._count.items === 1 ? "" : "en"} ·{" "}
                      {paymentMethodLabel(o.paymentMethod)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base text-ink truncate">
                      {o.firstName} {o.lastName}
                      <span className="text-stone"> · {o.city}{o.country !== "NL" ? ` (${o.country})` : ""}</span>
                    </p>
                    <p className="text-sm text-stone truncate">{o.email}</p>
                  </div>
                  <p className="font-serif text-lg text-ink tabular-nums md:text-right">{formatPrice(o.total)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="hidden sm:inline-flex items-center min-h-11 px-3 text-[11px] uppercase tracking-[0.2em] text-ink border border-line hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                  >
                    Details
                  </Link>
                  <DeleteOrderButton id={o.id} orderNumber={o.orderNumber} paid={o.status === "paid"} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={params.page}
        pageSize={ORDER_PAGE_SIZE}
        total={total}
        label="bestellingen"
        hrefFor={(p) => orderListHref({ ...params, page: p })}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-line p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-stone mb-2">{label}</p>
      <p className="font-serif text-3xl text-ink leading-none tabular-nums">{value}</p>
    </div>
  );
}
