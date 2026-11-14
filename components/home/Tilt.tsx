"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  /** Maximale kanteling in graden. */
  max?: number;
}

// 3D-kanteling op muisbeweging, zonder bibliotheek. Zet alleen CSS-variabelen
// (--rx/--ry kanteling, --px/--py parallax van .tilt-media, --mx/--my glans);
// de transform zelf staat in globals.css achter (hover: hover) en
// prefers-reduced-motion: no-preference. Touch en pen doen niets.
export function Tilt({ children, className = "", max = 5 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width - 0.5;
      const y = (clientY - r.top) / r.height - 0.5;
      el.dataset.active = "";
      el.style.setProperty("--rx", `${(-y * max).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * max).toFixed(2)}deg`);
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
      el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
    });
  }

  function onPointerLeave() {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    delete el.dataset.active;
    for (const v of ["--rx", "--ry", "--px", "--py"]) el.style.removeProperty(v);
  }

  return (
    <div ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className={`tilt ${className}`}>
      {children}
    </div>
  );
}
