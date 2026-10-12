import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

/**
 * Eén knop-component voor de hele shop (CLAUDE.md §7: hover + focus-state,
 * touch target ≥44px, tekst ≥14px). Gebaseerd op de btn-* utilities in
 * app/globals.css, zodat bestaande `className="btn-primary"`-plekken en deze
 * component er identiek uitzien.
 *
 * Varianten
 *  - primary      ink-vlak, hover accent-dark (wit erop 5,3:1)
 *  - secondary    ink-rand, hover gevuld — gelijke visuele weight als primary
 *                 voor eerlijke keuzes (cookiebanner, annuleren)
 *  - ghost        tekstknop zonder rand, hover bone
 *  - destructive  error-vlak voor verwijderen/annuleren met gevolgen
 *
 * Gebruik
 *  <Button onClick={...}>Bestel</Button>
 *  <Button href="/contact" variant="secondary">Neem contact op</Button>
 *  <Button size="sm" variant="ghost" iconLeft={<X />}>Sluiten</Button>
 *
 * Met `href` rendert hij een next/link (interne navigatie); zonder een
 * <button type="button"> (zet `type="submit"` expliciet in formulieren).
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-ghost",
  ghost: "btn-quiet",
  destructive: "btn-destructive",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Extra Tailwind-classes (bv. `w-full`). */
  className?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}

type AsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type AsLink = CommonProps &
  Omit<ComponentProps<typeof Link>, "className" | "children" | "href"> & {
    href: string;
  };

export type ButtonProps = AsButton | AsLink;

function buildClassName(variant: ButtonVariant, size: ButtonSize, className?: string): string {
  return [VARIANT_CLASS[variant], size === "sm" ? "btn-sm" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonProps) {
  const content = (
    <>
      {props.iconLeft && <span aria-hidden="true" className="inline-flex shrink-0">{props.iconLeft}</span>}
      <span>{props.children}</span>
      {props.iconRight && <span aria-hidden="true" className="inline-flex shrink-0">{props.iconRight}</span>}
    </>
  );

  if (props.href !== undefined) {
    const { variant = "primary", size = "md", className, iconLeft: _il, iconRight: _ir, children: _ch, href, ...linkProps } = props;
    return (
      <Link href={href} className={buildClassName(variant, size, className)} {...linkProps}>
        {content}
      </Link>
    );
  }

  const { variant = "primary", size = "md", className, iconLeft: _il, iconRight: _ir, children: _ch, href: _h, type, ...buttonProps } = props;
  return (
    <button type={type ?? "button"} className={buildClassName(variant, size, className)} {...buttonProps}>
      {content}
    </button>
  );
}
