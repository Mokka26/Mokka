"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function EditorialQuote() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Tekst komt binnen van beneden, gaat uit naar boven
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [60, 0, -60]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.3, 1, 1, 0.3]);

  return (
    <section ref={ref} className="py-40 lg:py-56 bg-paper overflow-hidden">
      <motion.div
        style={{ y, opacity }}
        className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14"
      >
        {/* Openingsteken */}
        <div className="flex items-start gap-6 lg:gap-10">
          <span className="font-serif italic text-6xl lg:text-8xl text-bronze leading-none -mt-2 lg:-mt-4 flex-shrink-0">
            &ldquo;
          </span>
          <div className="max-w-4xl">
            <p className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[3.75rem] text-ink leading-[1.15] tracking-[-0.01em]">
              Een huis wordt een <span className="italic">thuis</span> door de dingen die je kiest — en de verhalen die ze meedragen.
            </p>
            <div className="mt-10 lg:mt-14 flex items-center gap-4">
              <div className="w-12 h-[1px] bg-ink" />
              <p className="eyebrow">Onze filosofie</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
