"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProduct } from "../actions";

export default function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputId = useId();
  const titleId = useId();

  const handleDelete = () => {
    if (confirmText !== name) {
      setError("De naam komt niet overeen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (res.ok) {
        toast.success(`${name} naar de prullenbak verplaatst`);
        router.push("/admin/products");
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 text-sm uppercase tracking-[0.1em] text-error border border-error/30 hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Naar prullenbak
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white border border-line max-w-md w-full p-6 sm:p-8">
            <h3 id={titleId} className="font-serif text-2xl text-ink mb-3">Naar prullenbak?</h3>
            <p className="text-base text-stone leading-relaxed mb-6">
              <span className="text-ink font-medium">{name}</span> wordt verplaatst naar de prullenbak. Daar kun je het
              30 dagen lang herstellen of definitief verwijderen. Daarna wordt het automatisch definitief verwijderd
              (inclusief alle foto&apos;s).
            </p>

            <label htmlFor={inputId} className="block eyebrow-lg mb-2">
              Typ de productnaam om te bevestigen
            </label>
            <input
              id={inputId}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={pending}
              autoFocus
              autoComplete="off"
              className="w-full min-h-11 px-3 py-2.5 bg-bone border border-line text-ink text-base focus:outline-none focus:border-error disabled:opacity-60 mb-2"
              placeholder={name}
            />
            {error && (
              <p role="alert" className="text-sm text-error mb-3">
                {error}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex-1 min-h-11 px-6 py-3 text-sm uppercase tracking-[0.1em] border border-line text-ink hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors disabled:opacity-60"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending || confirmText !== name}
                className="flex-1 min-h-11 px-6 py-3 text-sm uppercase tracking-[0.1em] bg-error text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 transition-opacity disabled:opacity-50"
              >
                {pending ? "Bezig…" : "Naar prullenbak"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
