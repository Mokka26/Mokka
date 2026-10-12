"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { updateOrderFulfillment, type FulfillmentState } from "../actions";
import { FULFILLMENT_LABEL, FULFILLMENT_STATUSES } from "../../_lib/order-status";

const initial: FulfillmentState = {};

type Props = {
  order: {
    id: string;
    fulfillmentStatus: string;
    trackingCode: string | null;
    trackingUrl: string | null;
    adminNote: string | null;
    shippedAt: string | null;
  };
};

const inputCls =
  "w-full min-h-11 px-3 py-2.5 bg-bone border border-line text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-error";
const labelCls = "block text-[10px] uppercase tracking-[0.25em] text-stone mb-1.5";

export default function FulfillmentForm({ order }: Props) {
  const [state, action, pending] = useActionState(updateOrderFulfillment, initial);
  const ids = {
    status: useId(),
    code: useId(),
    url: useId(),
    note: useId(),
  };
  const lastToast = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.savedAt || state.savedAt === lastToast.current) return;
    lastToast.current = state.savedAt;
    if (state.mail === "failed") {
      toast.error("Opgeslagen, maar de verzendmail naar de klant is niet verstuurd. Stuur de klant handmatig een bericht.");
      return;
    }
    toast.success(state.mail === "sent" ? "Opgeslagen — verzendbevestiging naar de klant verstuurd" : "Afhandeling opgeslagen");
  }, [state.savedAt, state.mail]);

  const errorId = (field: string) => `${field}-error`;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={order.id} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={ids.status} className={labelCls}>Afhandelstatus</label>
          <select
            id={ids.status}
            name="fulfillmentStatus"
            defaultValue={order.fulfillmentStatus}
            aria-invalid={!!state.fieldErrors?.fulfillmentStatus}
            aria-describedby={state.fieldErrors?.fulfillmentStatus ? errorId(ids.status) : undefined}
            className={inputCls}
          >
            {FULFILLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{FULFILLMENT_LABEL[s]}</option>
            ))}
          </select>
          {state.fieldErrors?.fulfillmentStatus && (
            <p id={errorId(ids.status)} className="text-sm text-error mt-1.5">{state.fieldErrors.fulfillmentStatus}</p>
          )}
          {order.shippedAt && (
            <p className="text-sm text-stone mt-1.5">
              Verzonden op {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(order.shippedAt))}.
              De verzendmail wordt niet opnieuw verstuurd.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={ids.code} className={labelCls}>Trackingcode</label>
          <input
            id={ids.code}
            name="trackingCode"
            defaultValue={order.trackingCode ?? ""}
            maxLength={100}
            autoComplete="off"
            placeholder="Bijv. 3SABC123456789"
            aria-invalid={!!state.fieldErrors?.trackingCode}
            aria-describedby={state.fieldErrors?.trackingCode ? errorId(ids.code) : undefined}
            className={`${inputCls} font-mono`}
          />
          {state.fieldErrors?.trackingCode && (
            <p id={errorId(ids.code)} className="text-sm text-error mt-1.5">{state.fieldErrors.trackingCode}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={ids.url} className={labelCls}>Track &amp; trace-link</label>
        <input
          id={ids.url}
          name="trackingUrl"
          type="url"
          inputMode="url"
          defaultValue={order.trackingUrl ?? ""}
          maxLength={500}
          placeholder="https://…"
          aria-invalid={!!state.fieldErrors?.trackingUrl}
          aria-describedby={state.fieldErrors?.trackingUrl ? errorId(ids.url) : undefined}
          className={inputCls}
        />
        {state.fieldErrors?.trackingUrl && (
          <p id={errorId(ids.url)} className="text-sm text-error mt-1.5">{state.fieldErrors.trackingUrl}</p>
        )}
      </div>

      <div>
        <label htmlFor={ids.note} className={labelCls}>Interne notitie</label>
        <textarea
          id={ids.note}
          name="adminNote"
          defaultValue={order.adminNote ?? ""}
          rows={4}
          maxLength={2000}
          placeholder="Alleen zichtbaar in de admin — bijv. afspraak over bezorgmoment."
          aria-invalid={!!state.fieldErrors?.adminNote}
          aria-describedby={state.fieldErrors?.adminNote ? errorId(ids.note) : undefined}
          className={`${inputCls} leading-relaxed`}
        />
        {state.fieldErrors?.adminNote && (
          <p id={errorId(ids.note)} className="text-sm text-error mt-1.5">{state.fieldErrors.adminNote}</p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-error bg-error/10 border border-error/30 px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 bg-ink text-white px-6 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors disabled:opacity-60"
      >
        {pending ? "Opslaan…" : "Afhandeling opslaan"}
      </button>
    </form>
  );
}
