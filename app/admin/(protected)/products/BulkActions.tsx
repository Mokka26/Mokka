"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Star, StarOff, Tags, Euro, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/components/ui/price";
import { parsePrice } from "@/lib/parse-price";
import { bulkUpdateProducts, type BulkInput } from "./actions";

type Props = {
  selected: { id: string; name: string; price: number }[];
  categories: string[];
  onDone: () => void;
  onClear: () => void;
};

type Dialog = "category" | "price" | "trash" | null;

/** Bulk-opdracht zonder ids; distributief zodat elke variant zijn eigen velden houdt. */
type BulkCommand = BulkInput extends infer U ? (U extends BulkInput ? Omit<U, "ids"> : never) : never;

const btn =
  "inline-flex items-center gap-1.5 min-h-11 px-3 text-sm uppercase tracking-[0.1em] border border-white/30 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 transition-colors";

/** Balk met bulkacties; verschijnt zodra er een selectie is. */
export default function BulkActions({ selected, categories, onDone, onClear }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (input: BulkCommand) => {
    const ids = selected.map((s) => s.id);
    startTransition(async () => {
      const res = await bulkUpdateProducts({ ...input, ids });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.changed === 0) toast.error(res.message, { duration: 10_000 });
      else if (res.refused.length > 0) toast.warning(res.message, { duration: 10_000 });
      else toast.success(res.message);
      setDialog(null);
      router.refresh();
      onDone();
    });
  };

  if (selected.length === 0) return null;
  const n = selected.length;

  return (
    <>
      <div
        role="region"
        aria-label="Bulkacties"
        className="sticky top-0 z-20 bg-ink text-white px-4 py-3 mb-3 flex flex-wrap items-center gap-2"
      >
        <p className="text-sm mr-2 tabular-nums">
          {n} geselecteerd
        </p>
        <button type="button" disabled={pending} onClick={() => run({ action: "show" })} className={btn}>
          <Eye className="w-3.5 h-3.5" /> Zichtbaar maken
        </button>
        <button type="button" disabled={pending} onClick={() => run({ action: "hide" })} className={btn}>
          <EyeOff className="w-3.5 h-3.5" /> Verbergen
        </button>
        <button type="button" disabled={pending} onClick={() => run({ action: "feature", featured: true })} className={btn}>
          <Star className="w-3.5 h-3.5" /> Uitgelicht aan
        </button>
        <button type="button" disabled={pending} onClick={() => run({ action: "feature", featured: false })} className={btn}>
          <StarOff className="w-3.5 h-3.5" /> Uitgelicht uit
        </button>
        <button type="button" disabled={pending} onClick={() => setDialog("category")} className={btn}>
          <Tags className="w-3.5 h-3.5" /> Categorie wijzigen
        </button>
        <button type="button" disabled={pending} onClick={() => setDialog("price")} className={btn}>
          <Euro className="w-3.5 h-3.5" /> Prijs aanpassen
        </button>
        <button type="button" disabled={pending} onClick={() => setDialog("trash")} className={`${btn} bg-error border-error hover:bg-error/80`}>
          <Trash2 className="w-3.5 h-3.5" /> Naar prullenbak
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Selectie wissen"
          className="ml-auto inline-flex items-center justify-center w-11 h-11 text-mist hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {dialog === "category" && (
        <CategoryDialog
          count={n}
          categories={categories}
          pending={pending}
          onCancel={() => setDialog(null)}
          onConfirm={(category) => run({ action: "category", category })}
        />
      )}
      {dialog === "price" && (
        <PriceDialog
          selected={selected}
          pending={pending}
          onCancel={() => setDialog(null)}
          onConfirm={(mode, amount) => run({ action: "price", mode, amount })}
        />
      )}
      {dialog === "trash" && (
        <ConfirmDialog
          title={`${n} product${n === 1 ? "" : "en"} naar de prullenbak?`}
          body="Je kunt ze binnen 30 dagen herstellen via de prullenbak. Daarna worden ze definitief verwijderd, inclusief foto's."
          confirmLabel="Naar prullenbak"
          pending={pending}
          onCancel={() => setDialog(null)}
          onConfirm={() => run({ action: "trash" })}
        />
      )}
    </>
  );
}

// ─── Dialogen ────────────────────────────────────────────────────────

function Overlay({ titleId, children, onClose }: { titleId: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white border border-line max-w-md w-full p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}

const dialogBtnSecondary =
  "flex-1 min-h-11 px-5 py-3 text-sm uppercase tracking-[0.1em] border border-line text-ink hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60";
const dialogBtnPrimary =
  "flex-1 min-h-11 px-5 py-3 text-sm uppercase tracking-[0.1em] bg-ink text-white hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50";

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  return (
    <Overlay titleId={titleId} onClose={() => !pending && onCancel()}>
      <h3 id={titleId} className="font-serif text-2xl text-ink mb-3">{title}</h3>
      <p className="text-base text-stone leading-relaxed mb-6">{body}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={onCancel} disabled={pending} className={dialogBtnSecondary}>Annuleren</button>
        <button type="button" onClick={onConfirm} disabled={pending} className={`${dialogBtnPrimary} bg-error hover:bg-error`}>
          {pending ? "Bezig…" : confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}

function CategoryDialog({
  count,
  categories,
  pending,
  onCancel,
  onConfirm,
}: {
  count: number;
  categories: string[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: (category: string) => void;
}) {
  const titleId = useId();
  const selectId = useId();
  const [category, setCategory] = useState(categories[0] ?? "");
  return (
    <Overlay titleId={titleId} onClose={() => !pending && onCancel()}>
      <h3 id={titleId} className="font-serif text-2xl text-ink mb-3">Categorie wijzigen</h3>
      <p className="text-base text-stone mb-4">
        {count} product{count === 1 ? " krijgt" : "en krijgen"} de gekozen categorie.
      </p>
      <label htmlFor={selectId} className="block eyebrow-lg mb-1.5">
        Nieuwe categorie
      </label>
      <select
        id={selectId}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full min-h-11 px-3 py-2 bg-bone border border-line-strong text-ink text-base mb-6 focus:outline-none focus:border-accent"
      >
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={onCancel} disabled={pending} className={dialogBtnSecondary}>Annuleren</button>
        <button type="button" onClick={() => onConfirm(category)} disabled={pending || !category} className={dialogBtnPrimary}>
          {pending ? "Bezig…" : "Categorie toepassen"}
        </button>
      </div>
    </Overlay>
  );
}

function PriceDialog({
  selected,
  pending,
  onCancel,
  onConfirm,
}: {
  selected: { id: string; name: string; price: number }[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: (mode: "absolute" | "percent", amount: number) => void;
}) {
  const titleId = useId();
  const modeId = useId();
  const amountId = useId();
  const [mode, setMode] = useState<"absolute" | "percent">("percent");
  const [raw, setRaw] = useState("");

  // Percentage mag negatief en met komma ("-10" / "12,5"); bedrag via parsePrice.
  let amount: number | null = null;
  let error: string | null = null;
  if (raw.trim()) {
    if (mode === "percent") {
      const n = Number(raw.trim().replace(",", "."));
      if (!Number.isFinite(n)) error = "Ongeldig percentage";
      else if (n <= -100) error = "Percentage moet groter zijn dan -100";
      else amount = n;
    } else {
      const p = parsePrice(raw);
      if (p.error) error = p.error;
      else amount = p.value;
    }
  }

  const preview = selected.slice(0, 3).map((s) => ({
    name: s.name,
    before: s.price,
    after:
      amount == null
        ? null
        : Math.round((mode === "absolute" ? amount : s.price * (1 + amount / 100)) * 100) / 100,
  }));

  return (
    <Overlay titleId={titleId} onClose={() => !pending && onCancel()}>
      <h3 id={titleId} className="font-serif text-2xl text-ink mb-3">Prijs aanpassen</h3>
      <p className="text-base text-stone mb-4">
        Voor {selected.length} product{selected.length === 1 ? "" : "en"}. Alleen de geselecteerde producten
        veranderen (kleurvarianten die niet geselecteerd zijn blijven ongemoeid).
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label htmlFor={modeId} className="block eyebrow-lg mb-1.5">Manier</label>
          <select
            id={modeId}
            value={mode}
            onChange={(e) => setMode(e.target.value === "absolute" ? "absolute" : "percent")}
            className="w-full min-h-11 px-3 py-2 bg-bone border border-line-strong text-ink text-base focus:outline-none focus:border-accent"
          >
            <option value="percent">Percentage</option>
            <option value="absolute">Vast bedrag</option>
          </select>
        </div>
        <div>
          <label htmlFor={amountId} className="block eyebrow-lg mb-1.5">
            {mode === "percent" ? "Verschil in %" : "Nieuwe prijs (€)"}
          </label>
          <input
            id={amountId}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            inputMode="decimal"
            placeholder={mode === "percent" ? "bijv. -10 of 5" : "bijv. 599,00"}
            aria-invalid={!!error}
            aria-describedby={error ? `${amountId}-err` : undefined}
            className="w-full min-h-11 px-3 py-2 bg-bone border border-line-strong text-ink text-base tabular-nums focus:outline-none focus:border-accent aria-[invalid=true]:border-error"
          />
        </div>
      </div>
      {error && <p id={`${amountId}-err`} className="text-sm text-error mb-3">{error}</p>}

      <div className="bg-bone border border-line p-3 mb-6">
        <p className="eyebrow-lg mb-2">Voorbeeld</p>
        <ul className="space-y-1 text-sm">
          {preview.map((p) => (
            <li key={p.name} className="flex justify-between gap-3">
              <span className="text-ink truncate">{p.name}</span>
              <span className="text-stone tabular-nums whitespace-nowrap">
                {formatPrice(p.before)} → <span className="text-ink">{p.after == null ? "…" : formatPrice(p.after)}</span>
              </span>
            </li>
          ))}
          {selected.length > 3 && <li className="text-stone">… en {selected.length - 3} meer</li>}
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={onCancel} disabled={pending} className={dialogBtnSecondary}>Annuleren</button>
        <button
          type="button"
          onClick={() => amount != null && onConfirm(mode, amount)}
          disabled={pending || amount == null || !!error}
          className={dialogBtnPrimary}
        >
          {pending ? "Bezig…" : "Prijzen aanpassen"}
        </button>
      </div>
    </Overlay>
  );
}
