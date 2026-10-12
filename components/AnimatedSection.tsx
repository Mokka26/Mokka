import type { ReactNode } from "react";

// Voorheen framer-motion met `initial={{ opacity: 0 }}`: de server-HTML van
// elke sectie was onzichtbaar tot hydratie (LCP-vertraging, lege pagina zonder
// JavaScript). De API blijft gelijk zodat about/cart/checkout/contact niet
// hoeven te wijzigen, maar de wrappers renderen nu direct zichtbaar. De
// `delay`/`direction`/`speed`-props worden om compatibiliteit genegeerd.

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}

export default function AnimatedSection({ children, className = "" }: Props) {
  return <div className={className}>{children}</div>;
}

export function StaggerContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function ParallaxSection({ children, className = "" }: { children: ReactNode; className?: string; speed?: number }) {
  return <div className={className}>{children}</div>;
}
