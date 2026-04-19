"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface Props {
  children: string;
  className?: string;
  delay?: number;
  once?: boolean;
}

export default function TextReveal({ children, className = "", delay = 0, once = true }: Props) {
  const words = children.split(" ");

  return (
    <span className={className} aria-label={children}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom" aria-hidden>
          <motion.span
            className="inline-block"
            initial={{ y: "120%" }}
            whileInView={{ y: 0 }}
            viewport={{ once, margin: "-50px" }}
            transition={{
              duration: 0.9,
              delay: delay + i * 0.06,
              ease: [0.25, 0.4, 0.25, 1],
            }}
          >
            {word}
            {i < words.length - 1 && "\u00A0"}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
