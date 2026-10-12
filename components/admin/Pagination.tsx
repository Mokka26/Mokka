import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Server-side paginering (alleen links, geen JS). Gebruik in server-pagina's;
 * `hrefFor` is een functie en kan dus niet naar een client component.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  label = "resultaten",
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const btn =
    "inline-flex items-center justify-center min-w-11 h-11 px-3 border border-line text-sm uppercase tracking-[0.1em] text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors";
  const disabled = "opacity-40 pointer-events-none";

  return (
    <nav aria-label="Paginering" className="flex flex-wrap items-center justify-between gap-3 mt-6">
      <p className="text-sm text-stone tabular-nums">
        {from}–{to} van {total} {label}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={hrefFor(page - 1)}
          aria-label="Vorige pagina"
          aria-disabled={page <= 1}
          className={`${btn} ${page <= 1 ? disabled : ""}`}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm text-ink tabular-nums px-2">
          {page} / {totalPages}
        </span>
        <Link
          href={hrefFor(page + 1)}
          aria-label="Volgende pagina"
          aria-disabled={page >= totalPages}
          className={`${btn} ${page >= totalPages ? disabled : ""}`}
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </nav>
  );
}
