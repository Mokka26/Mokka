"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function ShowroomSection() {
  return (
    <section className="relative py-32 lg:py-48 bg-paper overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
          {/* Video — echt winkel beeld */}
          <motion.div
            className="lg:col-span-7 relative aspect-[4/3] overflow-hidden bg-bone"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/mokka.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-ink/10 pointer-events-none" />
          </motion.div>

          {/* Tekst */}
          <motion.div
            className="lg:col-span-5"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <p className="eyebrow mb-6">Bezoek Ons Atelier</p>
            <h2 className="display-md text-ink mb-6">
              2000m² <span className="italic">woonplezier</span>
            </h2>
            <p className="body-lg mb-8 max-w-md">
              Ervaar onze collectie in het echt. In onze showroom vind je alle
              stukken om te zien, voelen en uitproberen. Ons team staat klaar
              voor persoonlijk advies.
            </p>

            <div className="space-y-4 mb-10 border-t border-line pt-8">
              <div className="flex items-start gap-4">
                <span className="text-stone text-[11px] uppercase tracking-[0.25em] w-20 flex-shrink-0 pt-1">Adres</span>
                <p className="text-ink">Herengracht 100<br />1015 BS Amsterdam</p>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-stone text-[11px] uppercase tracking-[0.25em] w-20 flex-shrink-0 pt-1">Open</span>
                <p className="text-ink">
                  Ma — Vr 10:00—18:00
                  <br />
                  Za 11:00—17:00
                </p>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-stone text-[11px] uppercase tracking-[0.25em] w-20 flex-shrink-0 pt-1">Bel</span>
                <p className="text-ink">+31 (0)20 123 4567</p>
              </div>
            </div>

            <Link href="/contact" className="btn-link">
              Plan een bezoek
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
