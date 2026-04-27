"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const reviews = [
  {
    rating: 5,
    title: "Zorgvuldig gekozen stukken",
    text: "De bank is nog mooier dan op de foto's. Kwaliteit voel je direct. Levering was perfect georganiseerd en de monteurs waren vriendelijk en snel.",
    author: "Sanne van der Meer",
    location: "Amsterdam",
    product: "Armoni Bankstel",
  },
  {
    rating: 5,
    title: "Eindelijk een zaak met stijl",
    text: "Al jaren op zoek naar meubels die niet standaard zijn. De showroom is een belevenis en het advies was écht persoonlijk. Geen pushy verkoop, gewoon liefde voor het vak.",
    author: "Thomas Bakker",
    location: "Utrecht",
    product: "Oslo Loungestoel",
  },
  {
    rating: 5,
    title: "Premium kwaliteit",
    text: "We hebben een hoekbank, eettafel en dressoir samen aangeschaft. Alles klopt — materiaal, afwerking, levertijd. Zelden een bedrijf dat zó consistent is.",
    author: "Linda & Rob Janssen",
    location: "Haarlem",
    product: "Odessa Hoekbank",
  },
];

export default function SocialProof() {
  return (
    <section className="py-24 lg:py-32 bg-white border-y border-line">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        {/* Header — grote score bovenaan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-14 lg:mb-20"
        >
          <div className="flex items-center justify-center gap-1 mb-5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-bronze text-bronze" strokeWidth={0} />
            ))}
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-ink leading-[1] mb-4">
            <span className="italic">4.9</span> / 5 van 1.240+ klanten
          </h2>
          <p className="body-lg text-slate max-w-xl mx-auto">
            Onze klanten vertrouwen ons hun meest persoonlijke ruimte toe. Dat waarderen we.
          </p>
        </motion.div>

        {/* Review cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {reviews.map((review, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              className="flex flex-col p-8 lg:p-10 border border-line bg-paper/40"
            >
              {/* Sterren */}
              <div className="flex gap-0.5 mb-5">
                {[...Array(review.rating)].map((_, s) => (
                  <Star key={s} className="w-3.5 h-3.5 fill-bronze text-bronze" strokeWidth={0} />
                ))}
              </div>

              {/* Titel */}
              <h3 className="font-serif text-xl lg:text-2xl text-ink mb-4 leading-tight">
                &ldquo;{review.title}&rdquo;
              </h3>

              {/* Tekst */}
              <p className="text-slate text-sm leading-relaxed mb-8 flex-1">
                {review.text}
              </p>

              {/* Author + product */}
              <div className="pt-6 border-t border-line">
                <p className="font-serif text-base text-ink mb-1">{review.author}</p>
                <p className="text-xs text-stone">{review.location} · Over {review.product}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 lg:mt-20 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 text-[11px] uppercase tracking-[0.25em] text-stone"
        >
          <span>Trustpilot — Excellent</span>
          <span className="hidden sm:inline text-line">—</span>
          <span>CBW erkend</span>
          <span className="hidden sm:inline text-line">—</span>
          <span>Sinds 2024 in Amsterdam</span>
          <span className="hidden sm:inline text-line">—</span>
          <span>Ambachtelijk vervaardigd</span>
        </motion.div>
      </div>
    </section>
  );
}
