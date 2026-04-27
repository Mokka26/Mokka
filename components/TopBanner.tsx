"use client";

import { motion } from "framer-motion";

const messages = [
  "Gratis verzending vanaf €100",
  "Nieuwe voorjaarscollectie — nu online",
  "30 dagen bedenktijd op elk product",
  "Persoonlijk advies in onze showroom",
];

export default function TopBanner() {
  return (
    <div className="bg-ink text-white/80 border-b border-white/10 overflow-hidden">
      <div className="relative flex items-center justify-center h-9">
        <motion.div
          className="flex items-center gap-12 whitespace-nowrap"
          animate={{ x: [0, "-50%"] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          {[...messages, ...messages].map((msg, i) => (
            <span key={i} className="flex items-center gap-6 flex-shrink-0">
              <span className="w-1 h-1 rounded-full bg-bronze" />
              <span className="text-[11px] uppercase tracking-[0.3em]">{msg}</span>
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
