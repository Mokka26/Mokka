import type { Prisma } from "@prisma/client";

export const SUBSCRIBER_FILTERS = ["all", "confirmed", "unconfirmed", "unsubscribed"] as const;
export type SubscriberFilter = (typeof SUBSCRIBER_FILTERS)[number];

export const SUBSCRIBER_FILTER_LABEL: Record<SubscriberFilter, string> = {
  all: "Alle",
  confirmed: "Bevestigd",
  unconfirmed: "Onbevestigd",
  unsubscribed: "Afgemeld",
};

export function parseSubscriberFilter(v: string | null | undefined): SubscriberFilter {
  return v && (SUBSCRIBER_FILTERS as readonly string[]).includes(v) ? (v as SubscriberFilter) : "all";
}

export function subscriberWhere(filter: SubscriberFilter): Prisma.NewsletterSubscriberWhereInput {
  switch (filter) {
    case "confirmed":
      return { confirmedAt: { not: null }, unsubscribedAt: null };
    case "unconfirmed":
      return { confirmedAt: null, unsubscribedAt: null };
    case "unsubscribed":
      return { unsubscribedAt: { not: null } };
    default:
      return {};
  }
}

export function subscriberStatus(s: { confirmedAt: Date | null; unsubscribedAt: Date | null }): {
  key: Exclude<SubscriberFilter, "all">;
  label: string;
  className: string;
} {
  if (s.unsubscribedAt) return { key: "unsubscribed", label: "Afgemeld", className: "bg-stone/10 text-stone" };
  if (s.confirmedAt) return { key: "confirmed", label: "Bevestigd", className: "bg-success/10 text-success" };
  return { key: "unconfirmed", label: "Onbevestigd", className: "bg-accent/10 text-accent-dark" };
}
