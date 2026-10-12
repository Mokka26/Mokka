"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";

/**
 * Toegankelijke modal en drawer op het native <dialog>-element.
 *
 * Wat de browser voor ons regelt via showModal():
 *  - top-layer rendering (boven alles, geen z-index-gevechten)
 *  - de rest van de pagina wordt `inert` (focus blijft in de dialog)
 *  - Escape sluit (we vangen `cancel` af voor de sluit-animatie)
 *  - focus gaat terug naar het element dat de dialog opende
 *
 * Wat deze component toevoegt:
 *  - open/sluit-animaties via CSS (app/globals.css, `.mk-dialog`), met
 *    respect voor prefers-reduced-motion
 *  - klik op de backdrop sluit (optioneel)
 *  - focus op `initialFocusRef` of het eerste focusbare element
 *  - aria-labelledby op een (eventueel visueel verborgen) titel
 *  - body-scroll-lock via CSS (`body:has(dialog:modal)`)
 *
 * Gebruik — geef de trigger `aria-expanded={open}` en `aria-controls={id}`:
 *
 *  <button aria-expanded={open} aria-controls="menu" onClick={() => setOpen(true)}>Menu</button>
 *  <Drawer id="menu" side="left" open={open} onClose={() => setOpen(false)} title="Menu">
 *    ...
 *  </Drawer>
 *
 *  <Dialog id="zoeken" size="full" open={open} onClose={...} title="Zoeken" initialFocusRef={inputRef}>
 *    ...
 *  </Dialog>
 */

type Variant = "center" | "full" | "left" | "right" | "bottom";

export interface DialogBaseProps {
  open: boolean;
  onClose: () => void;
  /** Zichtbare of (met `hideTitle`) alleen voor screenreaders beschikbare titel. */
  title: string;
  hideTitle?: boolean;
  /** Vaste id zodat de trigger `aria-controls` kan zetten. */
  id?: string;
  children: ReactNode;
  /** Extra Tailwind-classes op het paneel (bv. `bg-white`). */
  className?: string;
  /** Element dat focus krijgt bij openen; anders het eerste focusbare element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Klik op de backdrop sluit. Default true. */
  closeOnBackdrop?: boolean;
  /** Eigen kopregel (vervangt de standaard titel + sluitknop). */
  header?: ReactNode;
  /** Vaste voet (bv. "Toon 24 producten"). */
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const CLOSE_ANIMATION_MS = 280; // = --dur-quick

function BaseDialog({
  open,
  onClose,
  title,
  hideTitle = false,
  id,
  children,
  className = "",
  initialFocusRef,
  closeOnBackdrop = true,
  header,
  footer,
  variant,
}: DialogBaseProps & { variant: Variant }) {
  const ref = useRef<HTMLDialogElement>(null);
  const generatedId = useId();
  const titleId = `${id ?? generatedId}-title`;
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  // Eigenaar sluit direct (bv. link-klik in het menu) of opent opnieuw:
  // sluit-status resetten tijdens render (React-patroon i.p.v. setState in effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (closing) setClosing(false);
  }

  // Sluit-animatie afspelen en daarna de eigenaar laten weten dat we dicht zijn.
  const requestClose = useCallback(() => {
    if (closeTimer.current !== null) return;
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setClosing(false);
      onClose();
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

  // open-prop synchroniseren met het native element.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      const target =
        initialFocusRef?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
      return;
    }

    if (!open && dialog.open) {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      dialog.close();
    }
  }, [open, initialFocusRef]);

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      id={id}
      className={`mk-dialog ${open ? "flex flex-col" : "hidden"} bg-paper text-ink shadow-[0_24px_60px_-20px_rgba(20,17,13,0.35)] ${className}`}
      data-variant={variant}
      data-closing={closing ? "" : undefined}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Escape: eerst animeren, dan sluiten.
        e.preventDefault();
        requestClose();
      }}
      onClose={() => {
        // Vangnet: als de browser zelf sloot (bv. form method="dialog").
        if (open) onClose();
      }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) requestClose();
      }}
    >
      {open && (
        <>
          {header ?? (
            <div className="flex items-center justify-between gap-4 px-6 sm:px-8 min-h-16 border-b border-line shrink-0">
              <h2 id={titleId} className={hideTitle ? "sr-only" : "eyebrow-lg text-ink"}>
                {title}
              </h2>
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-full text-ink hover:bg-bone transition-colors"
                aria-label="Sluiten"
              >
                <X className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          )}
          {header && <h2 id={titleId} className="sr-only">{title}</h2>}
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
          {footer && <div className="shrink-0 border-t border-line">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export interface DialogProps extends DialogBaseProps {
  /** `md` = gecentreerde kaart, `full` = volledig scherm (zoeken). */
  size?: "md" | "full";
}

export function Dialog({ size = "md", ...rest }: DialogProps) {
  return <BaseDialog {...rest} variant={size === "full" ? "full" : "center"} />;
}

export interface DrawerProps extends DialogBaseProps {
  side: "left" | "right" | "bottom";
}

export function Drawer({ side, ...rest }: DrawerProps) {
  return <BaseDialog {...rest} variant={side} />;
}

/** Sluitknop voor eigen headers/footers: 44px, met label. */
export function DialogCloseButton({ onClick, label = "Sluiten" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center w-11 h-11 rounded-full text-ink hover:bg-bone transition-colors"
      aria-label={label}
    >
      <X className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}
