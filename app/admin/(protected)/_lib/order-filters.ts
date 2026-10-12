import type { Prisma } from "@prisma/client";
import { isFulfillmentStatus, isOrderStatus, type FulfillmentStatus, type OrderStatus } from "./order-status";

/**
 * Filters voor de bestellingenlijst én de CSV-export: één parser zodat de
 * export exact teruggeeft wat de lijst toont.
 */
export const ORDER_PERIODS = ["all", "today", "7d", "30d", "custom"] as const;
export type OrderPeriod = (typeof ORDER_PERIODS)[number];

export const ORDER_PERIOD_LABEL: Record<OrderPeriod, string> = {
  all: "Alles",
  today: "Vandaag",
  "7d": "Laatste 7 dagen",
  "30d": "Laatste 30 dagen",
  custom: "Van – tot",
};

export type OrderListParams = {
  status?: OrderStatus;
  fulfillment?: FulfillmentStatus;
  period: OrderPeriod;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  q?: string;
  page: number;
};

export const ORDER_PAGE_SIZE = 50;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

type ParamSource = Record<string, string | string[] | undefined> | URLSearchParams;

function reader(sp: ParamSource): (k: string) => string | undefined {
  if (sp instanceof URLSearchParams) {
    return (k) => {
      const v = sp.get(k);
      return v && v.trim() ? v.trim() : undefined;
    };
  }
  return (k) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
}

export function parseOrderListParams(sp: ParamSource): OrderListParams {
  const get = reader(sp);
  const status = get("status");
  const fulfillment = get("fulfillment");
  const from = get("from");
  const to = get("to");
  const periodRaw = get("period");
  const hasRange = (from && YMD.test(from)) || (to && YMD.test(to));
  const period: OrderPeriod = hasRange
    ? "custom"
    : (ORDER_PERIODS as readonly string[]).includes(periodRaw ?? "")
      ? (periodRaw as OrderPeriod)
      : "all";
  const pageRaw = Number(get("page") ?? "1");
  return {
    status: status && isOrderStatus(status) ? status : undefined,
    fulfillment: fulfillment && isFulfillmentStatus(fulfillment) ? fulfillment : undefined,
    period,
    from: from && YMD.test(from) ? from : undefined,
    to: to && YMD.test(to) ? to : undefined,
    q: get("q")?.slice(0, 100),
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

// ─── Tijdzone: bestellingen worden in Nederlandse dagen gefilterd ──────────

function amsterdamOffsetMinutes(at: Date): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = part ? /GMT([+-])(\d{2}):(\d{2})/.exec(part) : null;
  if (!m) return 60;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** 00:00 Nederlandse tijd op de gegeven kalenderdag (YYYY-MM-DD). */
function startOfAmsterdamDay(ymd: string): Date {
  const utcMidnight = new Date(`${ymd}T00:00:00Z`);
  return new Date(utcMidnight.getTime() - amsterdamOffsetMinutes(utcMidnight) * 60_000);
}

function todayAmsterdam(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function orderDateRange(p: OrderListParams): { gte?: Date; lt?: Date } {
  const todayStart = startOfAmsterdamDay(todayAmsterdam());
  switch (p.period) {
    case "today":
      return { gte: todayStart };
    case "7d":
      return { gte: addDays(todayStart, -6) };
    case "30d":
      return { gte: addDays(todayStart, -29) };
    case "custom": {
      const range: { gte?: Date; lt?: Date } = {};
      if (p.from) range.gte = startOfAmsterdamDay(p.from);
      if (p.to) range.lt = addDays(startOfAmsterdamDay(p.to), 1);
      return range;
    }
    default:
      return {};
  }
}

export function orderListWhere(p: OrderListParams): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (p.status) and.push({ status: p.status });
  if (p.fulfillment) and.push({ fulfillmentStatus: p.fulfillment });
  const range = orderDateRange(p);
  if (range.gte || range.lt) and.push({ createdAt: range });
  if (p.q) {
    const or: Prisma.OrderWhereInput[] = [
      { orderNumber: { contains: p.q, mode: "insensitive" } },
      { email: { contains: p.q, mode: "insensitive" } },
      { firstName: { contains: p.q, mode: "insensitive" } },
      { lastName: { contains: p.q, mode: "insensitive" } },
      { molliePaymentId: { equals: p.q } },
    ];
    // "Jan de Vries" → voornaam én achternaam samen.
    const space = p.q.indexOf(" ");
    if (space > 0) {
      or.push({
        AND: [
          { firstName: { contains: p.q.slice(0, space), mode: "insensitive" } },
          { lastName: { contains: p.q.slice(space + 1).trim(), mode: "insensitive" } },
        ],
      });
    }
    and.push({ OR: or });
  }
  return and.length > 0 ? { AND: and } : {};
}

export function orderListQuery(p: Partial<OrderListParams>): string {
  const sp = new URLSearchParams();
  if (p.status) sp.set("status", p.status);
  if (p.fulfillment) sp.set("fulfillment", p.fulfillment);
  if (p.period && p.period !== "all" && p.period !== "custom") sp.set("period", p.period);
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  if (p.q) sp.set("q", p.q);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  return sp.toString();
}

export function orderListHref(p: Partial<OrderListParams>): string {
  const qs = orderListQuery(p);
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}
