import {
  fulfillmentClass,
  fulfillmentLabel,
  orderStatusClass,
  orderStatusLabel,
} from "@/app/admin/(protected)/_lib/order-status";

/** Pill op de gedeelde `.badge`-utility (13px); kleur via tokenklassen. */
export function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`badge ${className}`}
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
