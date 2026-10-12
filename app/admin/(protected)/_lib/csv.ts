/**
 * CSV voor Excel (NL): puntkomma als scheidingsteken, UTF-8 met BOM zodat
 * accenten goed openen. Cellen die met =, +, -, @ beginnen krijgen een
 * apostrof zodat spreadsheets ze niet als formule uitvoeren.
 */
const SEPARATOR = ";";

function escapeCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  let s = typeof value === "number" ? String(value) : value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(SEPARATOR)];
  for (const row of rows) lines.push(row.map(escapeCell).join(SEPARATOR));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Datum als 2026-10-12 voor bestandsnamen. */
export function isoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
