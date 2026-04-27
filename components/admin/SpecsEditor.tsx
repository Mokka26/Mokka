"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Row = { id: string; key: string; value: string };

const PRESETS = ["Afmetingen", "Materiaal", "Gewicht", "Kleur", "Stoffering", "Herkomst", "Garantie", "Levertijd"];

function rowsToObject(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    const v = r.value.trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export default function SpecsEditor({
  name,
  initial,
}: {
  name: string;
  initial: Record<string, string>;
}) {
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
        <div className="space-y-2 mb-3">
          {rows.map((row) => (
            <div key={row.id} className="flex items-stretch gap-2">
              <input
                value={row.key}
                onChange={(e) => updateRow(row.id, { key: e.target.value })}
                placeholder="Label (bijv. Afmetingen)"
                className="w-44 px-3 py-2 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-bronze"
              />
              <input
                value={row.value}
                onChange={(e) => updateRow(row.id, { value: e.target.value })}
                placeholder="Waarde (bijv. 220x90x80cm)"
                className="flex-1 px-3 py-2 bg-white border border-line text-ink text-sm focus:outline-none focus:border-bronze"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="px-3 text-stone hover:text-red-700 hover:bg-bone transition-colors"
                aria-label="Verwijder spec"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {availablePresets.length > 0 && (
          <>
            {availablePresets.slice(0, 6).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => addRow(p)}
                className="text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 border border-line text-stone hover:border-bronze hover:text-ink transition-colors"
              >
                + {p}
              </button>
            ))}
          </>
        )}
        <button
          type="button"
          onClick={() => addRow()}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 bg-ink text-white hover:bg-bronze transition-colors"
        >
          <Plus className="w-3 h-3" />
          Eigen
        </button>
      </div>

      {rows.length === 0 && (
        <p className="text-[12px] text-stone mt-3">
          Geen specs ingevuld. Voeg er één toe via de presets hierboven.
        </p>
      )}
    </div>
  );
}
