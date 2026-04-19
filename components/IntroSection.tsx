"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import TextReveal from "./TextReveal";

export default function IntroSection() {
  return (
    <section className="py-32 lg:py-48">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          <div className="lg:col-span-3">
            <motion.p
              className="eyebrow"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              01 — Filosofie
            </motion.p>
          </div>
          <div className="lg:col-span-8 lg:col-start-5">
            <h2 className="display-md text-ink mb-10 leading-[1.1]">
              <TextReveal>Een huis is meer dan vier muren.</TextReveal>
              <br />
              <span className="italic text-ink/50">
                <TextReveal delay={0.4}>Het is waar je leeft.</TextReveal>
              </span>
            </h2>
            <div className="max-w-2xl">
              <motion.p
                className="body-lg"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                Mokka Home Interior selecteert meubels en interieurstukken die niet alleen mooi zijn, maar ook een verhaal vertellen. Vakmanschap, duurzame materialen en tijdloos design — dat is wat elk stuk verbindt.
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 1.1 }}
              >
                <Link href="/about" className="btn-link mt-12">
                  Ons verhaal
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                  </svg>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
