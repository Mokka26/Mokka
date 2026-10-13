"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUp, Star } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/components/ui/price";
import { clearCategoryOrder, saveCategoryOrder } from "./actions";

export type OrderProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  featured: boolean;
  /** Vierkante thumbnail-URL (al door Cloudinary geschaald) of null. */
  thumb: string | null;
  /** Link naar het bewerkformulier in de admin. */
  editHref: string;
};

interface Props {
  slug: string;
  label: string;
  initial: OrderProduct[];
  /** True als minstens één product al een handmatige positie heeft. */
  hasManualOrder: boolean;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const bounded = Math.max(0, Math.min(list.length - 1, to));
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(bounded, 0, item);
  return next;
}

const iconBtn =
  "inline-flex items-center justify-center w-11 h-11 border border-line bg-white text-ink hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink";

/**
 * Volgorde-editor: pijltjes (omhoog/omlaag/bovenaan) en een positieveld per
 * product. Wijzigingen staan lokaal tot "Volgorde opslaan"; de shop toont de
 * nieuwe volgorde direct na opslaan (cache wordt ververst door de action).
 */
export function CategoryOrderEditor({ slug, label, initial, hasManualOrder }: Props) {
  const [items, setItems] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = items.some((p, i) => p.id !== saved[i]?.id);

  const setPosition = (index: number, value: string) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) return;
    setItems((list) => move(list, index, n - 1));
  };

  const save = () => {
    startTransition(async () => {
      const res = await saveCategoryOrder({ slug, ids: items.map((p) => p.id) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(items);
      toast.success(`Volgorde van ${label} opgeslagen`);
    });
  };

  const reset = () => {
    startTransition(async () => {
      const res = await clearCategoryOrder(slug);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Handmatige volgorde van ${label} gewist`);
      // De pagina opnieuw laden geeft de automatische volgorde (favoriet, nieuwste).
      window.location.reload();
    });
  };

  if (items.length === 0) {
    return <p className="text-base text-stone">Geen zichtbare producten in deze categorie.</p>;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 px-1 py-3 bg-paper/95 backdrop-blur border-b border-line mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="inline-flex items-center min-h-11 bg-ink text-white px-5 py-3 text-sm uppercase tracking-[0.1em] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors disabled:opacity-40 disabled:hover:bg-ink"
        >
          {pending ? "Bezig…" : "Volgorde opslaan"}
        </button>
        {dirty && <span className="text-sm text-stone">Niet-opgeslagen wijzigingen</span>}
        {hasManualOrder && !dirty && (
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="inline-flex items-center min-h-11 px-3 text-sm uppercase tracking-[0.1em] text-stone hover:text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Handmatige volgorde wissen
          </button>
        )}
        <span className="ml-auto text-sm text-stone tabular-nums">{items.length} producten</span>
      </div>

      <ol className="divide-y divide-line border-y border-line">
        {items.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 sm:gap-4 py-2.5">
            <label className="shrink-0">
              <span className="sr-only">Positie van {p.name}</span>
              <input
                type="number"
                min={1}
                max={items.length}
                value={i + 1}
                onChange={(e) => setPosition(i, e.target.value)}
                className="w-16 min-h-11 px-2 text-center bg-white border border-line-strong text-ink text-base tabular-nums focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
            <div className="relative w-14 h-14 shrink-0 bg-bone overflow-hidden rounded-[6px]">
              {p.thumb && <Image src={p.thumb} alt="" fill unoptimized sizes="56px" className="object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <Link href={p.editHref} className="text-base text-ink font-medium leading-snug hover:text-accent line-clamp-2">
                {p.name}
              </Link>
              <p className="text-sm text-stone tabular-nums mt-0.5 flex items-center gap-2">
                {formatPrice(p.price)}
                {p.featured && (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Star className="w-3.5 h-3.5" aria-hidden="true" /> favoriet
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => setItems((l) => move(l, i, 0))} disabled={i === 0} className={iconBtn} aria-label={`${p.name} bovenaan zetten`}>
                <ChevronsUp className="w-4 h-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setItems((l) => move(l, i, i - 1))} disabled={i === 0} className={iconBtn} aria-label={`${p.name} één omhoog`}>
                <ArrowUp className="w-4 h-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setItems((l) => move(l, i, i + 1))} disabled={i === items.length - 1} className={iconBtn} aria-label={`${p.name} één omlaag`}>
                <ArrowDown className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
