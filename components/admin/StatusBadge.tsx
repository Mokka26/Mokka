import {
  fulfillmentClass,
  fulfillmentLabel,
  orderStatusClass,
  orderStatusLabel,
} from "@/app/admin/(protected)/_lib/order-status";

/** Pill met tokenkleuren; werkt in server- én client components. */
export function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-full whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  return <StatusPill label={orderStatusLabel(status)} className={orderStatusClass(status)} />;
}

export function FulfillmentBadge({ status }: { status: string }) {
  return <StatusPill label={fulfillmentLabel(status)} className={fulfillmentClass(status)} />;
}
