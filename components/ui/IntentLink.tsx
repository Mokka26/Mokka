"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, type ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "prefetch" | "href"> & { href: string };

/**
 * next/link zonder viewport-prefetch: prefetcht pas bij intentie (muis erover,
 * focus via toetsenbord, of aanraken op mobiel). Voor lange lijsten met links
 * (productkaarten) en de footer, waar viewport-prefetch tientallen
 * _rsc-verzoeken (honderden kB) per pagina gaf. Navigatie blijft even snel
 * voor de link waar iemand daadwerkelijk op gaat klikken.
 */
export function IntentLink({ href, onPointerEnter, onFocus, onTouchStart, ...rest }: Props) {
  const router = useRouter();
  const prefetched = useRef<string | null>(null);

  const prefetch = useCallback(() => {
    if (prefetched.current === href) return;
    prefetched.current = href;
    router.prefetch(href);
  }, [router, href]);

  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onPointerEnter={(e) => {
        prefetch();
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        prefetch();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        prefetch();
        onTouchStart?.(e);
      }}
    />
  );
}
