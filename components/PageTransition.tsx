"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (reduced) {
    return <div key={pathname}>{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ clipPath: "inset(0 0 100% 0)", opacity: 0 }}
      animate={{ clipPath: "inset(0 0 0% 0)", opacity: 1 }}
      transition={{
        clipPath: { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
      }}
      style={{ willChange: "clip-path, opacity" }}
    >
      {children}
    </motion.div>
  );
}
