"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AnimatedSection from "@/components/AnimatedSection";
import { useCart } from "@/context/CartContext";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", houseNumber: "", city: "", zipCode: "" });

  const shipping = totalPrice >= 100 ? 0 : 9.95;
  const total = totalPrice + shipping;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    clearCart();
    setSuccess(true);
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 pt-24">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="bg-white border border-line p-12 sm:p-16 text-center max-w-lg">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-ink mb-3">Bestelling Bevestigd!</h1>
          <p className="text-stone mb-1">Bedankt voor je bestelling, {form.firstName}.</p>
          <p className="text-stone text-sm mb-8">Je ontvangt een bevestiging per e-mail.</p>
          <button onClick={() => router.push("/")} className="btn-primary">Terug naar Home</button>
        </motion.div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 pt-24">
        <AnimatedSection className="text-center">
          <h1 className="display-md text-ink mb-4">Afrekenen</h1>
          <p className="text-stone mb-8">Je winkelwagen is leeg.</p>
          <button onClick={() => router.push("/products")} className="btn-primary">Producten Bekijken</button>
        </AnimatedSection>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-32 pb-20">
      <AnimatedSection className="mb-10">
        <p className="eyebrow">Bijna Klaar</p>
        <h1 className="display-md text-ink">Afrekenen</h1>
      </AnimatedSection>

      {/* Stappen */}
      <AnimatedSection className="mb-10">
        <div className="flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.2em]">
          <span className="text-bronze font-medium">1. Gegevens</span>
          <span className="w-8 h-[1px] bg-bone" />
          <span className="text-stone">2. Betaling</span>
          <span className="w-8 h-[1px] bg-bone" />
          <span className="text-stone">3. Bevestiging</span>
        </div>
      </AnimatedSection>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <AnimatedSection direction="left" className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Contactgegevens */}
            <div className="bg-white border border-line p-6 sm:p-8">
              <h3 className="font-serif text-lg text-ink mb-6">Contactgegevens</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Voornaam *</label>
                  <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required className="input-field" />
                </div>
                <div>
                  <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Achternaam *</label>
                  <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required className="input-field" />
                </div>
                <div>
                  <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">E-mail *</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} required className="input-field" />
                </div>
                <div>
                  <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Telefoonnummer</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="input-field" />
                </div>
              </div>
            </div>

            {/* Verzendadres */}
            <div className="bg-white border border-line p-6 sm:p-8">
              <h3 className="font-serif text-lg text-ink mb-6">Verzendadres</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Straatnaam *</label>
                    <input type="text" name="address" value={form.address} onChange={handleChange} required className="input-field" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Huisnr. *</label>
                    <input type="text" name="houseNumber" value={form.houseNumber} onChange={handleChange} required className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Postcode *</label>
                  <input type="text" name="zipCode" value={form.zipCode} onChange={handleChange} required className="input-field" placeholder="1234 AB" />
                </div>
                <div>
                  <label className="block text-[11px] text-stone uppercase tracking-[0.2em] mb-2">Stad *</label>
                  <input type="text" name="city" value={form.city} onChange={handleChange} required className="input-field" />
                </div>
              </div>
            </div>

            {/* Betaalmethode (demo) */}
            <div className="bg-white border border-line p-6 sm:p-8">
              <h3 className="font-serif text-lg text-ink mb-6">Betaalmethode</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border border-bronze bg-paper/50 cursor-pointer">
                  <input type="radio" name="payment" defaultChecked className="accent-bronze" />
                  <span className="text-ink text-sm font-medium">iDEAL</span>
                  <span className="text-stone text-xs ml-auto">Direct betalen via je bank</span>
                </label>
                <label className="flex items-center gap-3 p-4 border border-line cursor-pointer hover:border-stone transition-colors">
                  <input type="radio" name="payment" className="accent-bronze" />
                  <span className="text-ink text-sm font-medium">Creditcard</span>
                  <span className="text-stone text-xs ml-auto">Visa, Mastercard</span>
                </label>
                <label className="flex items-center gap-3 p-4 border border-line cursor-pointer hover:border-stone transition-colors">
                  <input type="radio" name="payment" className="accent-bronze" />
                  <span className="text-ink text-sm font-medium">Bancontact</span>
                  <span className="text-stone text-xs ml-auto">Voor Belgische klanten</span>
                </label>
              </div>
              <p className="text-[10px] text-stone mt-4">Je wordt doorgestuurd naar een beveiligde betaalomgeving.</p>
            </div>

            <motion.button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50" whileTap={{ scale: 0.98 }}>
              {submitting ? "Verwerken..." : `Bestelling Plaatsen — \u20AC${total.toFixed(2)}`}
            </motion.button>
          </form>
        </AnimatedSection>

        {/* Samenvatting */}
        <AnimatedSection direction="right" className="lg:col-span-1">
          <div className="bg-white border border-line p-6 sm:p-8 sticky top-28">
            <h3 className="font-serif text-lg text-ink mb-6">Jouw Bestelling</h3>
            <div className="space-y-4 mb-6">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-4">
                  <div className="relative w-16 h-16 bg-bone flex-shrink-0 overflow-hidden">
                    <img src={JSON.parse(item.product.images)[0]} alt={item.product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-ink text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-stone text-xs">Aantal: {item.quantity}</p>
                    <p className="text-bronze text-sm font-medium">&euro;{(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line pt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-stone">Subtotaal</span>
                <span className="text-ink">&euro;{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone">Verzending</span>
                <span className="text-ink">{shipping === 0 ? "Gratis" : `\u20AC${shipping.toFixed(2)}`}</span>
              </div>
              <div className="border-t border-line pt-3 flex justify-between font-medium text-base">
                <span className="text-ink">Totaal</span>
                <span className="text-ink">&euro;{total.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-stone">Inclusief 21% BTW</p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
