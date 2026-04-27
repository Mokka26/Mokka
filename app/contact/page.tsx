"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import AnimatedSection from "@/components/AnimatedSection";

const contactInfo = [
  { icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", label: "E-mail", value: "hallo@mokkahome.nl" },
  { icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", label: "Telefoon", value: "+31 (0)70 123 4567" },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setSubmitted(true); };

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-32 lg:pt-40 pb-28 lg:pb-40">
      {/* Editorial header */}
      <AnimatedSection className="mb-20 lg:mb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4 mb-8">
              <span className="font-serif italic text-stone text-sm">— 01</span>
              <span className="eyebrow">Neem Contact Op</span>
            </div>
            <h1 className="display-xl text-ink">
              Contact
            </h1>
          </div>
          <div className="lg:col-span-4">
            <p className="body-lg text-slate">
              Of je nu een vraag hebt over onze producten, hulp nodig hebt bij een bestelling, of advies wilt over je interieur — wij staan voor je klaar.
            </p>
          </div>
        </div>
      </AnimatedSection>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        {/* Info — 40% */}
        <AnimatedSection direction="left" className="lg:col-span-5">
          <div className="border-t border-line pt-10">
            <span className="eyebrow">Bereikbaar</span>
            <h2 className="display-md text-ink mt-4 mb-12">
              We horen graag <span className="italic text-stone/80">van je</span>
            </h2>

            <div className="space-y-10">
              {contactInfo.map((item) => (
                <div key={item.label} className="flex items-start gap-5">
                  <svg className="w-5 h-5 text-bronze flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <div>
                    <p className="eyebrow mb-2">{item.label}</p>
                    <p className="font-serif text-xl text-ink">{item.value}</p>
                  </div>
                </div>
              ))}

              <div className="flex items-start gap-5">
                <svg className="w-5 h-5 text-bronze flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="eyebrow mb-2">Adres</p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Dynamostraat+5%2C+2525+KB+Den+Haag"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-serif text-xl text-ink leading-snug hover:text-bronze transition-colors inline-block"
                  >
                    Dynamostraat 5<br />2525 KB Den Haag
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <svg className="w-5 h-5 text-bronze flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="eyebrow mb-2">Openingstijden</p>
                  <p className="font-serif text-xl text-ink leading-snug">
                    Ma — Vr: 10:00 — 18:00<br />
                    Za: 11:00 — 17:00<br />
                    Zo: Gesloten
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Formulier — 60% */}
        <AnimatedSection direction="right" className="lg:col-span-7">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-line p-12 lg:p-20 text-center"
            >
              <div className="w-16 h-16 border border-line rounded-full flex items-center justify-center mx-auto mb-10">
                <svg className="w-7 h-7 text-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="eyebrow mb-6">Verzonden</p>
              <h3 className="display-md text-ink mb-4">Bericht Verzonden!</h3>
              <p className="body-lg text-slate">Bedankt. We reageren binnen 24 uur.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-line p-8 lg:p-12 space-y-8">
              <div className="mb-2">
                <span className="eyebrow">Schrijf ons</span>
                <h3 className="font-serif text-2xl text-ink mt-3">Stuur een bericht</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className="eyebrow block mb-3">Naam *</label>
                  <input type="text" name="name" value={form.name} onChange={handleChange} required className="input-field" />
                </div>
                <div>
                  <label className="eyebrow block mb-3">Telefoon</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="input-field" />
                </div>
              </div>
              <div>
                <label className="eyebrow block mb-3">E-mail *</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required className="input-field" />
              </div>
              <div>
                <label className="eyebrow block mb-3">Onderwerp *</label>
                <select name="subject" value={form.subject} onChange={handleChange} required className="input-field">
                  <option value="">Kies een onderwerp</option>
                  <option value="product">Vraag over een product</option>
                  <option value="bestelling">Vraag over een bestelling</option>
                  <option value="retour">Retour of ruil</option>
                  <option value="advies">Interieuradvies</option>
                  <option value="anders">Anders</option>
                </select>
              </div>
              <div>
                <label className="eyebrow block mb-3">Bericht *</label>
                <textarea name="message" value={form.message} onChange={handleChange} required rows={6} className="input-field resize-none" />
              </div>
              <motion.button type="submit" className="btn-primary w-full" whileTap={{ scale: 0.98 }}>
                Versturen
              </motion.button>
            </form>
          )}
        </AnimatedSection>
      </div>
    </div>
  );
}
