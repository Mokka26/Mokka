"use client";

import { useEffect } from "react";

export default function useTouchHover() {
  useEffect(() => {
    let currentEl: Element | null = null;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const card = el?.closest("[data-hover-card]");

      if (card !== currentEl) {
        if (currentEl) currentEl.removeAttribute("data-touched");
        currentEl = card || null;
        if (currentEl) currentEl.setAttribute("data-touched", "");
      }
    };

    const handleTouchEnd = () => {
      if (currentEl) {
        currentEl.removeAttribute("data-touched");
        currentEl = null;
      }
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);
}
