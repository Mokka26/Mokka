"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative h-screen w-full overflow-hidden bg-ink">
      {/* Premium interieur foto als hero */}
      <Image
        src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=2400&q=90"
        alt="Mokka Home Interior"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />

      {/* Gradient overlay — donker onderaan voor leesbaarheid, lichter boven */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/20 to-ink/70" />

      {/* Content */}
      <div className="relative z-10 h-full w-full flex flex-col">
        {/* Ruimte voor navbar */}
        <div className="h-24 lg:h-28" />

        {/* Hero tekst */}
        <div className="flex-1 flex items-end">
          <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pb-20 lg:pb-28">
            <div className="max-w-3xl">
              <motion.p
                className="text-white/70 text-[11px] uppercase tracking-[0.4em] mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3 }}
              >
                Nieuwe Collectie — 2025
              </motion.p>

              <motion.h1
                className="display-xl text-white mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
              >
                <span className="italic font-light">Geleefd</span> met
                <br />
                vakmanschap
              </motion.h1>

              <motion.p
                className="text-white/80 text-base sm:text-lg max-w-xl mb-10 leading-relaxed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.7 }}
              >
                Premium meubels en interieurstukken, zorgvuldig geselecteerd voor het moderne thuis.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4 items-start sm:items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.9 }}
              >
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center gap-3 bg-white text-ink px-10 py-4 text-xs uppercase tracking-[0.2em] font-medium hover:bg-bronze hover:text-white transition-colors duration-400"
                >
                  Ontdek de Collectie
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-3 text-white text-xs uppercase tracking-[0.2em] font-medium border-b border-white/40 hover:border-white pb-1 transition-colors"
                >
                  Ons verhaal
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                  </svg>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Onder: metadata */}
        <div className="hidden lg:flex justify-between items-end px-14 pb-10 text-white/50 text-[11px] uppercase tracking-[0.3em]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.4 }}
          >
            Est. 2024 — Amsterdam
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.4 }}
            className="flex items-center gap-3"
          >
            <span>Scroll</span>
            <motion.div
              className="w-12 h-[1px] bg-white/40"
              animate={{ scaleX: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "left" }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
