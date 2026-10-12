"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteOrder } from "./actions";

type Props = {
  id: string;
  orderNumber: string;
  paid: boolean;
  /** Na verwijderen hierheen (detailpagina); leeg = alleen verversen (lijst). */
  redirectTo?: string;
  variant?: "icon" | "full";
};

/**
 * Verwijderknop met bevestiging in de pagina (geen window.confirm). Voor een
 * betaalde bestelling moet het ordernummer getypt worden.
 */
export default function DeleteOrderButton({ id, orderNumber, paid, redirectTo, variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputId = useId();
  const titleId = useId();

  const canConfirm = !paid || confirmText.trim() === orderNumber;

  const close = () => {
    if (pending) return;
    setOpen(false);
    setConfirmText("");
    setError(null);
  };

  const handleDelete = () => {
    if (!canConfirm) {
      setError("Het ordernummer komt niet overeen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteOrder({ id, confirmation: paid ? confirmText.trim() : undefined });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Bestelling ${orderNumber} verwijderd`);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
      setOpen(false);
    });
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Bestelling ${orderNumber} verwijderen`}
          title="Verwijderen"
          className="inline-flex items-center justify-center w-11 h-11 text-stone hover:text-error hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 text-[11px] uppercase tracking-[0.25em] text-error border border-error/30 hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Bestelling verwijderen
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white border border-line max-w-md w-full p-6 sm:p-8">
            <h3 id={titleId} className="font-serif text-2xl text-ink mb-3">
              Bestelling {orderNumber} verwijderen?
            </h3>
            <p className="text-base text-stone leading-relaxed mb-5">
              {paid
                ? "Dit is een betaalde bestelling. De bestelling en alle orderregels worden definitief verwijderd; de betaling bij Mollie blijft bestaan. Dit kan niet ongedaan gemaakt worden."
                : "De bestelling en alle orderregels worden definitief verwijderd. Dit kan niet ongedaan gemaakt worden."}
            </p>

            {paid && (
              <div className="mb-4">
                <label htmlFor={inputId} className="block text-[11px] uppercase tracking-[0.25em] text-stone mb-2">
                  Typ het ordernummer om te bevestigen
                </label>
                <input
                  id={inputId}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={pending}
                  autoFocus
                  autoComplete="off"
                  placeholder={orderNumber}
                  className="w-full min-h-11 px-3 py-2.5 bg-bone border border-line text-ink text-base font-mono focus:outline-none focus:border-error disabled:opacity-60"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-error mb-3">
                {error}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-4">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="flex-1 min-h-11 px-6 py-3 text-[11px] uppercase tracking-[0.25em] border border-line text-ink hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors disabled:opacity-60"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending || !canConfirm}
                className="flex-1 min-h-11 px-6 py-3 text-[11px] uppercase tracking-[0.25em] bg-error text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 transition-opacity disabled:opacity-50"
              >
                {pending ? "Verwijderen…" : "Definitief verwijderen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
