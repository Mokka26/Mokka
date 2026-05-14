"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

export interface UseRevealOptions {
  delay?: number;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  distance?: number;
  direction?: Direction;
}

const transformFor = (dir: Direction, distance: number, revealed: boolean) => {
  if (revealed) return "translate3d(0, 0, 0)";
  switch (dir) {
    case "up": return `translate3d(0, ${distance}px, 0)`;
    case "down": return `translate3d(0, -${distance}px, 0)`;
    case "left": return `translate3d(${distance}px, 0, 0)`;
    case "right": return `translate3d(-${distance}px, 0, 0)`;
    default: return "translate3d(0, 0, 0)";
  }
};

export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseRevealOptions = {}
): { ref: RefObject<T | null>; style: React.CSSProperties; revealed: boolean } {
  const {
    delay = 0,
    threshold = 0.12,
    rootMargin = "0px 0px -8% 0px",
    once = true,
    distance = 28,
    direction = "up",
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
    opacity: revealed ? 1 : 0,
    transform: transformFor(direction, distance, revealed),
    transition: `opacity 720ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 720ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
    willChange: "opacity, transform",
  };

  return { ref, style, revealed };
}
