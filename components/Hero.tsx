"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative min-h-screen w-full bg-paper">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        {/* LINKS — Beeld (7/12) */}
        <div className="lg:col-span-7 relative min-h-[60vh] lg:min-h-screen order-2 lg:order-1 overflow-hidden">
          <motion.div
            initial={{ scale: 1.05, opacity: 0.9 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.6, ease: [0.25, 0.4, 0.25, 1] }}
            className="absolute inset-0"
          >
            <Image
              src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1800&q=95"
              alt="Mokka Home Interior sfeerbeeld"
              fill
              priority
              quality={95}
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 58vw"
            />
          </motion.div>

          {/* Subtiel label linksonder op het beeld */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="absolute bottom-6 left-6 sm:bottom-8 sm:left-8 flex items-center gap-3 bg-white/90 backdrop-blur-sm px-4 py-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-bronze" />
            <span className="text-ink text-[10px] uppercase tracking-[0.3em]">Voorjaar — 2026</span>
          </motion.div>
        </div>

        {/* RECHTS — Tekst op paper (5/12) */}
        <div className="lg:col-span-5 flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-16 lg:py-24 order-1 lg:order-2">
          <div className="max-w-lg mx-auto lg:mx-0 w-full">
            {/* Klein nummer/meta */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex items-center gap-4 mb-8 lg:mb-10"
            >
              <span className="font-serif italic text-bronze text-sm">— 01</span>
              <span className="eyebrow">Nieuwe collectie</span>
            </motion.div>

            {/* Hoofdclaim */}
            <motion.h1
              className="font-serif text-[clamp(2.5rem,6vw,5.5rem)] text-ink leading-[0.98] tracking-[-0.01em] mb-8 lg:mb-10"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            >
              Meubels
              <br />
              gemaakt om
              <br />
              in te <span className="italic text-stone/80">leven</span>.
            </motion.h1>

            {/* Korte intro */}
            <motion.p
              className="body-lg text-slate mb-10 lg:mb-12 max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Zorgvuldig geselecteerde stukken — gemaakt met oog voor detail en ruimte om te leven.
            </motion.p>

            {/* CTA's */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-3 bg-ink text-white px-8 py-4 text-[11px] uppercase tracking-[0.25em] font-medium hover:bg-bronze transition-colors duration-500"
              >
                Bekijk collectie
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                </svg>
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-3 text-ink text-[11px] uppercase tracking-[0.25em] border-b border-ink pb-1 hover:gap-4 transition-all self-start sm:self-auto"
              >
                Ons verhaal
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
