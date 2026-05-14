"use client";

import { useCallback, useRef, type RefObject } from "react";

export interface UseInFrameParallaxOptions {
  maxOffset?: number;
  axis?: "both" | "x" | "y";
}

export function useInFrameParallax<T extends HTMLElement = HTMLElement>(
  options: UseInFrameParallaxOptions = {}
): {
  ref: RefObject<T | null>;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
} {
  const { maxOffset = 10, axis = "both" } = options;
  const ref = useRef<T | null>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const py = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    if (axis !== "y") node.style.setProperty("--parallax-x", `${px * maxOffset}px`);
    if (axis !== "x") node.style.setProperty("--parallax-y", `${py * maxOffset}px`);
  }, [maxOffset, axis]);

  const onMouseLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--parallax-x", "0px");
    node.style.setProperty("--parallax-y", "0px");
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
