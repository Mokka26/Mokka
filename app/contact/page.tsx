"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import AnimatedSection from "@/components/AnimatedSection";

const contactInfo = [
  { icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", label: "E-mail", value: "hallo@mokkahome.nl" },
  { icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", label: "Telefoon", value: "+31 (0)20 123 4567" },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setSubmitted(true); };

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-32 pb-20">
      <AnimatedSection className="text-center mb-16">
        <p className="eyebrow">Neem Contact Op</p>
        <h1 className="display-md text-ink">Contact</h1>
        <div className="w-12 h-[1px] bg-bronze mx-auto mt-6" />
      </AnimatedSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-5xl mx-auto">
        {/* Info */}
        <AnimatedSection direction="left">
          <h3 className="font-serif text-2xl text-ink mb-4">We horen graag van je</h3>
          <p className="text-stone leading-relaxed mb-10">
            Of je nu een vraag hebt over onze producten, hulp nodig hebt bij een bestelling, of advies wilt over je interieur — wij staan voor je klaar.
          </p>

          <div className="space-y-6">
            {contactInfo.map((item) => (
              <div key={item.label} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white border border-line rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] text-stone uppercase tracking-[0.2em] mb-1">{item.label}</p>
                  <p className="text-ink">{item.value}</p>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white border border-line rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] text-stone uppercase tracking-[0.2em] mb-1">Adres</p>
                <p className="text-ink">Herengracht 100<br />1015 BS Amsterdam</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white border border-line rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] text-stone uppercase tracking-[0.2em] mb-1">Openingstijden</p>
                <p className="text-ink">Ma — Vr: 10:00 — 18:00<br />Za: 11:00 — 17:00<br />Zo: Gesloten</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Formulier */}
        <AnimatedSection direction="right">
          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-line p-10 text-center">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-serif text-xl text-ink mb-2">Bericht Verzonden!</h3>
              <p className="text-stone text-sm">Bedankt. We reageren binnen 24 uur.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-line p-6 sm:p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Naam *</label>
                  <input type="text" name="name" value={form.name} onChange={handleChange} required className="input-field" />
                </div>
                <div>
                  <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Telefoon</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">E-mail *</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required className="input-field" />
              </div>
              <div>
                <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Onderwerp *</label>
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
                <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Bericht *</label>
                <textarea name="message" value={form.message} onChange={handleChange} required rows={5} className="input-field resize-none" />
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
