"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteProduct } from "../actions";

export default function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (confirmText !== name) {
      setError("Naam komt niet overeen");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (res.ok) {
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
        className="inline-flex items-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-[0.25em] text-red-700 border border-red-200 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Verwijder
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center px-6"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="bg-white border border-line max-w-md w-full p-8">
            <h3 className="font-serif text-2xl text-ink mb-3">Product verwijderen?</h3>
            <p className="text-sm text-stone leading-relaxed mb-6">
              Dit verwijdert <span className="text-ink font-medium">{name}</span> uit de catalogus. Bestaande
              orderregels blijven behouden, maar het product is niet meer beschikbaar voor nieuwe bestellingen.
            </p>

            <p className="text-[11px] uppercase tracking-[0.25em] text-stone mb-2">
              Type de productnaam om te bevestigen
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={pending}
              autoFocus
              className="w-full px-3 py-2.5 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-red-700 disabled:opacity-60 mb-2"
              placeholder={name}
            />
            {error && <p className="text-[11px] text-red-700 mb-3">{error}</p>}

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex-1 px-6 py-3 text-[11px] uppercase tracking-[0.25em] border border-line text-ink hover:bg-bone transition-colors disabled:opacity-60"
              >
                Annuleer
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending || confirmText !== name}
                className="flex-1 px-6 py-3 text-[11px] uppercase tracking-[0.25em] bg-red-700 text-white hover:bg-red-800 transition-colors disabled:opacity-50"
              >
                {pending ? "Verwijderen…" : "Verwijder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
