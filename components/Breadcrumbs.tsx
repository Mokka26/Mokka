import Link from "next/link";
import type { BreadcrumbItem } from "@/lib/jsonLd";

interface Props {
  /** Volledige keten incl. "Home" als eerste item; het laatste item is de huidige pagina. */
  items: ReadonlyArray<BreadcrumbItem>;
  className?: string;
}

/**
 * Zichtbaar kruimelpad (server component). Gebruik dezelfde `items` als voor
 * `buildBreadcrumbJsonLd()` zodat HTML en BreadcrumbList-schema gelijk zijn.
 */
export function Breadcrumbs({ items, className = "" }: Props) {
  if (items.length === 0) return null;
  const last = items.length - 1;

  return (
    <nav aria-label="Kruimelpad" className={className}>
      <ol className="flex flex-wrap items-center gap-y-1 text-[12px] sm:text-[13px] uppercase tracking-[0.2em] font-medium text-stone">
        {items.map((item, idx) => (
          <li key={item.url} className="flex items-center min-w-0">
            {idx > 0 && (
              <span aria-hidden="true" className="mx-3 text-mist">
                /
              </span>
            )}
            {idx === last ? (
              <span aria-current="page" className="text-ink truncate max-w-[60vw] sm:max-w-none">
                {item.name}
              </span>
            ) : (
              <Link
                href={item.url}
                className="inline-flex items-center min-h-11 hover:text-accent focus-visible:text-accent transition-colors"
              >
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
