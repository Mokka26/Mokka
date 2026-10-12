"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// Eén plek waar framer-motion de systeemvoorkeur "minder beweging" leest.
// Elke motion.* in de boom respecteert daardoor prefers-reduced-motion
// zonder per component een matchMedia-check.
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
