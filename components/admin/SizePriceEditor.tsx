"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export type SizeVariant = { label: string; price: number; listPrice?: number };
type Row = { id: string; label: string; price: string; listPrice: string };

// Snelknoppen voor de meest voorkomende bedmaten (breedte × 200).
const PRESETS = ["90 × 200", "140 × 200", "160 × 200", "180 × 200"];

function rowsToVariants(rows: Row[]): SizeVariant[] {
  const out: SizeVariant[] = [];
  for (const r of rows) {
    const label = r.label.trim();
    const price = Number(r.price);
    if (!label || !Number.isFinite(price) || price < 0) continue;
    const lp = Number(r.listPrice);
    const variant: SizeVariant = { label, price };
    // Adviesprijs alleen meenemen als die hoger is dan de verkoopprijs.
    if (r.listPrice.trim() && Number.isFinite(lp) && lp > price) variant.listPrice = lp;
    out.push(variant);
  }
  return out;
}

export default function SizePriceEditor({
  name,
  initial,
}: {
  name: string;
  initial: SizeVariant[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((v, i) => ({
      id: `${i}-${v.label}`,
      label: v.label,
      price: String(v.price),
      listPrice: v.listPrice != null ? String(v.listPrice) : "",
    })),
  );

  const addRow = (preset?: string) =>
    setRows((rs) => [
      ...rs,
      { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: preset ?? "", price: "", listPrice: "" },
    ]);

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  const usedLabels = new Set(rows.map((r) => r.label.trim().toLowerCase()));
  const availablePresets = PRESETS.filter((p) => !usedLabels.has(p.toLowerCase()));

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(rowsToVariants(rows))} />

      {rows.length > 0 && (
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-stone">
            <span className="w-44">Maat</span>
            <span className="flex-1">Verkoopprijs (€)</span>
            <span className="flex-1">Adviesprijs (€, optioneel)</span>
            <span className="w-9" />
          </div>
          {rows.map((row) => (
            <div key={row.id} className="flex items-stretch gap-2">
              <input
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                placeholder="Maat (bijv. 140 × 200)"
                className="w-44 px-3 py-2 bg-bone border border-line text-ink text-sm focus:outline-none focus:border-accent"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={row.price}
                onChange={(e) => updateRow(row.id, { price: e.target.value })}
                placeholder="bijv. 599"
                className="flex-1 px-3 py-2 bg-white border border-line text-ink text-sm tabular-nums focus:outline-none focus:border-accent"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={row.listPrice}
                onChange={(e) => updateRow(row.id, { listPrice: e.target.value })}
                placeholder="bijv. 699"
                className="flex-1 px-3 py-2 bg-white border border-line text-stone text-sm tabular-nums focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="px-3 text-stone hover:text-red-700 hover:bg-bone transition-colors"
                aria-label="Verwijder maat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {availablePresets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => addRow(p)}
            className="text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 border border-line text-stone hover:border-accent hover:text-ink transition-colors"
          >
            + {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => addRow()}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 bg-ink text-white hover:bg-accent transition-colors"
        >
          <Plus className="w-3 h-3" />
          Eigen maat
        </button>
      </div>

      <p className="text-[12px] text-stone mt-3">
        {rows.length === 0
          ? "Geen maten — dit product heeft één vaste prijs (het prijsveld hierboven)."
          : "De laagste maatprijs hoeft niet gelijk te zijn aan het prijsveld; op de kaart toont de categorie de vaste basisprijs."}
      </p>
    </div>
  );
}
