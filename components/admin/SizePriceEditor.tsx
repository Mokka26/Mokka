"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { parsePrice } from "@/lib/parse-price";

export type SizeVariant = { label: string; price?: number; listPrice?: number };
type Row = { id: string; label: string; price: string; listPrice: string };

// Snelknoppen voor de meest voorkomende bedmaten (breedte × 200).
const PRESETS = ["90 × 200", "140 × 200", "160 × 200", "180 × 200"];

function money(n: number | undefined): string {
  return n == null ? "" : n.toFixed(2).replace(".", ",");
}

/** Fout per rij; leeg = in orde. De server valideert hetzelfde nog eens. */
function rowError(r: Row): string | null {
  if (!r.label.trim()) return null;
  const p = parsePrice(r.price);
  if (p.error) return p.error;
  if (p.value != null && p.value <= 0) return "Prijs moet groter dan 0 zijn, of leeg (= productprijs)";
  const lp = parsePrice(r.listPrice);
  if (lp.error) return `Adviesprijs: ${lp.error}`;
  if (lp.value != null && p.value == null) return "Adviesprijs alleen mogelijk met een eigen verkoopprijs";
  if (lp.value != null && p.value != null && lp.value <= p.value) return "Adviesprijs moet hoger zijn dan de verkoopprijs";
  return null;
}

export default function SizePriceEditor({
  name,
  initial,
  onChange,
}: {
  name: string;
  initial: SizeVariant[];
  onChange?: () => void;
}) {
  const baseId = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((v, i) => ({ id: `${i}-${v.label}`, label: v.label, price: money(v.price), listPrice: money(v.listPrice) })),
  );

  const addRow = (preset?: string) => {
    setRows((rs) => [
      ...rs,
      { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: preset ?? "", price: "", listPrice: "" },
    ]);
    onChange?.();
  };

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    onChange?.();
  };

  const usedLabels = new Set(rows.map((r) => r.label.trim().toLowerCase()));
  const availablePresets = PRESETS.filter((p) => !usedLabels.has(p.toLowerCase()));

  // De server parseert de prijzen (parsePrice); hier gaan ze als tekst mee zodat
  // een onleesbare invoer een duidelijke fout oplevert en nooit stil wegvalt.
  const payload = rows
    .filter((r) => r.label.trim())
    .map((r) => ({ label: r.label.trim(), price: r.price.trim(), listPrice: r.listPrice.trim() }));

  const inputCls =
    "min-h-11 px-3 py-2 border border-line-strong text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-error";

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(payload)} />

      {rows.length > 0 && (
        <div className="space-y-3 mb-3">
          <div className="hidden sm:grid sm:grid-cols-[11rem_1fr_1fr_2.75rem] gap-2 eyebrow-lg">
            <span>Maat</span>
            <span>Verkoopprijs incl. btw</span>
            <span>Adviesprijs (optioneel)</span>
            <span />
          </div>
          {rows.map((row, idx) => {
            const error = rowError(row);
            const errId = `${baseId}-${row.id}-err`;
            return (
              <div key={row.id}>
                <div className="grid grid-cols-[1fr_2.75rem] sm:grid-cols-[11rem_1fr_1fr_2.75rem] gap-2 items-stretch">
                  <input
                    value={row.label}
                    onChange={(e) => updateRow(row.id, { label: e.target.value })}
                    placeholder="Maat (bijv. 140 × 200)"
                    aria-label={`Maat ${idx + 1}`}
                    maxLength={40}
                    className={`${inputCls} bg-bone col-span-1`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="sm:order-last inline-flex items-center justify-center min-h-11 text-stone hover:text-error hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    aria-label={`Maat ${row.label || idx + 1} verwijderen`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <input
                    value={row.price}
                    onChange={(e) => updateRow(row.id, { price: e.target.value })}
                    inputMode="decimal"
                    placeholder="leeg = productprijs"
                    aria-label={`Verkoopprijs voor maat ${row.label || idx + 1}`}
                    aria-invalid={!!error}
                    aria-describedby={error ? errId : undefined}
                    className={`${inputCls} bg-white tabular-nums`}
                  />
                  <input
                    value={row.listPrice}
                    onChange={(e) => updateRow(row.id, { listPrice: e.target.value })}
                    inputMode="decimal"
                    placeholder="bijv. 699"
                    aria-label={`Adviesprijs voor maat ${row.label || idx + 1}`}
                    aria-invalid={!!error}
                    className={`${inputCls} bg-white tabular-nums`}
                  />
                </div>
                {error && (
                  <p id={errId} className="text-sm text-error mt-1">
                    {row.label.trim() ? `${row.label.trim()}: ` : ""}
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {availablePresets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => addRow(p)}
            className="min-h-11 text-sm uppercase tracking-[0.1em] px-3 border border-line text-stone hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
          >
            + {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => addRow()}
          className="inline-flex items-center gap-1.5 min-h-11 text-sm uppercase tracking-[0.1em] px-3 bg-ink text-white hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Eigen maat
        </button>
      </div>

      <p className="text-sm text-stone mt-3">
        {rows.length === 0
          ? "Geen maten — dit product heeft één prijs (de verkoopprijs hiernaast)."
          : "Laat de prijs leeg om de verkoop- en adviesprijs van het product te gebruiken. Vul alleen een prijs in als die maat een andere prijs heeft."}
      </p>
    </div>
  );
}
