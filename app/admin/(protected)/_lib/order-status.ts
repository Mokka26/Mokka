/**
 * Labels en token-klassen voor bestelstatussen. Eén plek, zodat lijst, detail,
 * dashboard en CSV-export dezelfde Nederlandse termen gebruiken.
 */
export const ORDER_STATUSES = ["open", "paid", "failed", "canceled", "expired", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENT_STATUSES = ["pending", "processing", "shipped", "delivered", "returned"] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  open: "Open",
  paid: "Betaald",
  failed: "Mislukt",
  canceled: "Geannuleerd",
  expired: "Verlopen",
  refunded: "Terugbetaald",
};

export const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  pending: "Te verwerken",
  processing: "In behandeling",
  shipped: "Verzonden",
  delivered: "Afgeleverd",
  returned: "Retour",
};

export function isOrderStatus(v: string): v is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(v);
}

export function isFulfillmentStatus(v: string): v is FulfillmentStatus {
  return (FULFILLMENT_STATUSES as readonly string[]).includes(v);
}

export function orderStatusLabel(status: string): string {
  return isOrderStatus(status) ? ORDER_STATUS_LABEL[status] : status;
}

export function fulfillmentLabel(status: string): string {
  return isFulfillmentStatus(status) ? FULFILLMENT_LABEL[status] : status;
}

/** Tailwind-tokens (geen ruwe kleuren) per betaalstatus. */
export function orderStatusClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-success/10 text-success";
    case "open":
      return "bg-accent/10 text-accent-dark";
    case "failed":
      return "bg-error/10 text-error";
    default:
      return "bg-stone/10 text-stone";
  }
}

export function fulfillmentClass(status: string): string {
  switch (status) {
    case "pending":
    case "processing":
      return "bg-accent/10 text-accent-dark";
    case "shipped":
    case "delivered":
      return "bg-success/10 text-success";
    case "returned":
      return "bg-error/10 text-error";
    default:
      return "bg-stone/10 text-stone";
  }
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  ideal: "iDEAL",
  creditcard: "Creditcard",
  klarna: "Klarna",
  klarnapaylater: "Klarna achteraf betalen",
  klarnasliceit: "Klarna gespreid betalen",
  applepay: "Apple Pay",
  googlepay: "Google Pay",
  paypal: "PayPal",
  bancontact: "Bancontact",
  banktransfer: "Overboeking",
  in3: "in3",
};

export function paymentMethodLabel(method: string | null): string {
  if (!method) return "—";
  return PAYMENT_METHOD_LABEL[method] ?? method;
}

const COUNTRY_LABEL: Record<string, string> = { NL: "Nederland", BE: "België", DE: "Duitsland" };

export function countryLabel(code: string): string {
  return COUNTRY_LABEL[code] ?? code;
}
