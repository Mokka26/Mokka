"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteContactMessage, deleteSubscriber } from "./actions";

type Common = {
  /** Wat verwijderd wordt, voor de bevestiging ("bericht van Jan"). */
  label: string;
  redirectTo?: string;
  variant?: "icon" | "full";
};

type Props = Common & ({ kind: "message"; id: string } | { kind: "subscriber"; email: string });

/** Verwijderknop met bevestiging in de pagina voor berichten en abonnees. */
export default function DeleteButton(props: Props) {
  const { label, redirectTo, variant = "icon" } = props;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const titleId = useId();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = props.kind === "message" ? await deleteContactMessage({ id: props.id }) : await deleteSubscriber({ email: props.email });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`${label} verwijderd`);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${label} verwijderen`}
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
          Verwijderen
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white border border-line max-w-md w-full p-6 sm:p-8">
            <h3 id={titleId} className="font-serif text-2xl text-ink mb-3">
              {label} verwijderen?
            </h3>
            <p className="text-base text-stone leading-relaxed mb-6">Dit kan niet ongedaan gemaakt worden.</p>
            {error && (
              <p role="alert" className="text-sm text-error mb-3">
                {error}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex-1 min-h-11 px-6 py-3 text-[11px] uppercase tracking-[0.25em] border border-line text-ink hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={run}
                disabled={pending}
                className="flex-1 min-h-11 px-6 py-3 text-[11px] uppercase tracking-[0.25em] bg-error text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {pending ? "Bezig…" : "Verwijderen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
