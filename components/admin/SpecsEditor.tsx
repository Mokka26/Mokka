"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Row = { id: string; key: string; value: string };

const PRESETS = [
  "Afmetingen", "Materiaal", "Kleur", "Serie", "Categorie",
  "Stoffering", "Patroon", "Gewicht", "Herkomst", "Garantie", "Levertijd",
];

function rowsToObject(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    const v = r.value.trim();
    if (k && v) out[k] = v;
  }
  return out;
}

// 16px tekst (geen iOS-zoom), 44px hoog, zichtbare focus.
const inputCls =
  "w-full min-h-11 px-3 py-2 border border-line-strong text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent";

export default function SpecsEditor({
  name,
  initial,
}: {
  name: string;
  initial: Record<string, string>;
}) {
  const baseId = useId();
  const [rows, setRows] = useState<Row[]>(() => {
    const entries = Object.entries(initial);
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => ({ id: `${i}-${k}`, key: k, value: v }));
  });

  const addRow = (preset?: string) => {
    setRows((rs) => [
      ...rs,
      { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key: preset ?? "", value: "" },
    ]);
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const usedKeys = new Set(rows.map((r) => r.key.trim().toLowerCase()));
  const availablePresets = PRESETS.filter((p) => !usedKeys.has(p.toLowerCase()));

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(rowsToObject(rows))} />

      {rows.length > 0 && (
        <div className="space-y-3 sm:space-y-2 mb-3">
          {rows.map((row, idx) => {
            const n = row.key.trim() || String(idx + 1);
            return (
              // < sm: label + prullenbak op rij 1, waarde op rij 2 (volle breedte).
              // sm+: label | waarde | prullenbak op één rij. DOM-volgorde blijft
              // label → waarde → verwijderen, dus de tab-volgorde is logisch.
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_2.75rem] sm:grid-cols-[11rem_minmax(0,1fr)_2.75rem] gap-2 items-stretch"
              >
                <input
                  id={`${baseId}-${row.id}-key`}
                  value={row.key}
                  onChange={(e) => updateRow(row.id, { key: e.target.value })}
                  placeholder="Label (bijv. Afmetingen)"
                  aria-label={`Label van specificatie ${idx + 1}`}
                  className={`${inputCls} bg-bone col-start-1 row-start-1 sm:col-auto sm:row-auto`}
                />
                <input
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  placeholder="Waarde (bijv. 220x90x80cm)"
                  aria-label={`Waarde van ${n}`}
                  className={`${inputCls} bg-white col-span-2 row-start-2 sm:col-span-1 sm:row-auto`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="col-start-2 row-start-1 sm:col-auto sm:row-auto inline-flex items-center justify-center min-h-11 min-w-11 text-stone hover:text-error hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                  aria-label={`Specificatie ${n} verwijderen`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {availablePresets.slice(0, 6).map((p) => (
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
          className="min-h-11 inline-flex items-center gap-1.5 text-sm uppercase tracking-[0.1em] px-3 bg-ink text-white hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors"
        >
          <Plus className="w-3 h-3" aria-hidden="true" />
          Eigen
        </button>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-stone mt-3">
          Geen specs ingevuld. Voeg er één toe via de presets hierboven.
        </p>
      )}
    </div>
  );
}
