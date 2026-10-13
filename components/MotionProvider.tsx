"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// Animatie-features (domAnimation ≈ 15 kB) worden pas ná hydratie als los
// chunk geladen; de root-bundle bevat alleen de kleine LazyMotion/`m`-kern.
// Componenten die hiervan profiteren gebruiken `m.*` i.p.v. `motion.*`
// (`motion.*` sleept zijn eigen volledige feature-set mee).
const loadFeatures = () => import("framer-motion").then((mod) => mod.domAnimation);

// Eén plek waar framer-motion de systeemvoorkeur "minder beweging" leest.
// Elke m.*/motion.* in de boom respecteert daardoor prefers-reduced-motion
// zonder per component een matchMedia-check.
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
