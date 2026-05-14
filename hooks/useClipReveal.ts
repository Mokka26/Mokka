"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type ClipFrom = "top" | "bottom" | "left" | "right";

export interface UseClipRevealOptions {
  from?: ClipFrom;
  delay?: number;
  duration?: number;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

const hiddenClip = (from: ClipFrom): string => {
  switch (from) {
    case "top": return "inset(0 0 100% 0)";
    case "bottom": return "inset(100% 0 0 0)";
    case "left": return "inset(0 100% 0 0)";
    case "right": return "inset(0 0 0 100%)";
  }
};

export function useClipReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseClipRevealOptions = {}
): { ref: RefObject<T | null>; style: React.CSSProperties; revealed: boolean } {
  const {
    from = "top",
    delay = 0,
    duration = 880,
    threshold = 0.18,
    rootMargin = "0px 0px -6% 0px",
    once = true,
  } = options;

  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setRevealed(false);
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  const style: React.CSSProperties = {
    clipPath: revealed ? "inset(0 0 0 0)" : hiddenClip(from),
    WebkitClipPath: revealed ? "inset(0 0 0 0)" : hiddenClip(from),
    transition: `clip-path ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, -webkit-clip-path ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
    willChange: "clip-path",
  };

  return { ref, style, revealed };
}
