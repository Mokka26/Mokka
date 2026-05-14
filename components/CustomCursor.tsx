"use client";

import { useEffect, useRef, useState } from "react";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(any-pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ok = finePointer && !reduced && window.innerWidth >= 1024;
    setEnabled(ok);
    if (ok) document.body.classList.add("has-custom-cursor");
    return () => document.body.classList.remove("has-custom-cursor");
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (!active) setActive(true);

      const dot = dotRef.current;
      if (dot) {
        dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
    };

    const handleLeave = () => setActive(false);
    const handleEnter = () => setActive(true);

    const handleOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest(
        'a, button, [role="button"], [data-cursor-hover], input, textarea, select, label'
      );
      setHovering(Boolean(el));
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);
    window.addEventListener("mouseenter", handleEnter);
    window.addEventListener("mouseover", handleOver);

    const tick = () => {
      const lerp = 0.18;
      ringPos.current.x += (target.current.x - ringPos.current.x) * lerp;
      ringPos.current.y += (target.current.y - ringPos.current.y) * lerp;
      const ring = ringRef.current;
      if (ring) {
        ring.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0) translate(-50%, -50%)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("mouseenter", handleEnter);
      window.removeEventListener("mouseover", handleOver);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, active]);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[9999] hidden lg:block"
        style={{
          width: hovering ? 0 : 6,
          height: hovering ? 0 : 6,
          borderRadius: "9999px",
          backgroundColor: "var(--color-accent)",
          opacity: active ? 1 : 0,
          transition: "width 280ms cubic-bezier(0.22, 1, 0.36, 1), height 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease",
        }}
      />
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[9999] hidden lg:block"
        style={{
          width: hovering ? 56 : 28,
          height: hovering ? 56 : 28,
          borderRadius: "9999px",
          border: "1px solid var(--color-accent)",
          opacity: active ? (hovering ? 0.85 : 0.55) : 0,
          backgroundColor: hovering ? "rgba(185, 107, 76, 0.06)" : "transparent",
          transition: "width 360ms cubic-bezier(0.22, 1, 0.36, 1), height 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease, background-color 280ms ease",
        }}
      />
    </>
  );
}
