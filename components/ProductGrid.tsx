import type { HTMLAttributes, ReactNode } from "react";

const COLUMNS = {
  /** Overzichten met filters (categorie, aanbiedingen, nieuw). */
  3: "lg:grid-cols-3",
  /** Rijen met aanbevelingen (PDP, homepage, inhoudspagina's). */
  4: "lg:grid-cols-4",
} as const;

/** Eén gap-recept voor elke productgrid, zodat kaarten overal even ver uit elkaar staan. */
const GAP = "gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12";

type Props = HTMLAttributes<HTMLElement> & {
  columns?: keyof typeof COLUMNS;
  /** `ul` als elk kind een `<li>` is. */
  as?: "div" | "ul";
  children: ReactNode;
};

/** Grid voor productkaarten (en hun skeletons): 2 kolommen mobiel, 3 of 4 vanaf lg. */
export function ProductGrid({ columns = 3, as: Tag = "div", className, children, ...rest }: Props) {
  const classes = ["grid grid-cols-2", COLUMNS[columns], GAP, Tag === "ul" ? "list-none" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
