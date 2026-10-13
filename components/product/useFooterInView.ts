"use client";

import { useEffect, useState } from "react";

/**
 * Is de site-footer (deels) in beeld? Vaste balken onderaan (PDP-koopbalk,
 * filterknop op categoriepagina's) verbergen zichzelf dan, zodat ze de
 * footerlinks niet bedekken. Zonder IntersectionObserver blijft de balk
 * gewoon staan.
 */
export function useFooterInView(): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return inView;
}
