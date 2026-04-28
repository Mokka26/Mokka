"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AnimatedSection from "@/components/AnimatedSection";
import { useCart } from "@/context/CartContext";
import { firstImageUrl } from "@/lib/imageHelpers";

type FormFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  houseNumber: string;
  city: string;
  zipCode: string;
};
type FieldName = keyof FormFields;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTCODE_RE = /^\d{4}\s?[A-Za-z]{2}$/;
const PHONE_RE = /^[+\d\s()-]{7,20}$/;

function validateField(name: FieldName, value: string): string | undefined {
  const v = value.trim();
  if (name === "phone") {
    if (v && !PHONE_RE.test(v)) return "Ongeldig telefoonnummer";
    return undefined;
  }
  if (!v) return "Vereist";
  if (name === "email" && !EMAIL_RE.test(v)) return "Ongeldig e-mailadres";
  if (name === "zipCode" && !POSTCODE_RE.test(v)) return "Bijv. 1234 AB";
  if (name === "firstName" && v.length < 2) return "Minstens 2 tekens";
  if (name === "lastName" && v.length < 2) return "Minstens 2 tekens";
  return undefined;
}

function validateAll(form: FormFields): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  (Object.keys(form) as FieldName[]).forEach((name) => {
    const e = validateField(name, form[name]);
    if (e) errors[name] = e;
  });
  return errors;
}

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FormFields>({ firstName: "", lastName: "", email: "", phone: "", address: "", houseNumber: "", city: "", zipCode: "" });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});

  const shipping = totalPrice >= 100 ? 0 : 9.95;
  const total = totalPrice + shipping;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const name = e.target.name as FieldName;
    const value = e.target.value;
    setForm((f) => ({ ...f, [name]: value }));
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const name = e.target.name as FieldName;
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, form[name]) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allErrors = validateAll(form);
    setErrors(allErrors);
    setTouched({
      firstName: true, lastName: true, email: true, phone: true,
      address: true, houseNumber: true, city: true, zipCode: true,
    });
    if (Object.keys(allErrors).length > 0) {
      const first = document.querySelector<HTMLInputElement>(
        `[name="${Object.keys(allErrors)[0]}"]`,
      );
      first?.focus();
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    clearCart();
    setSuccess(true);
    setSubmitting(false);
  };

  const fieldClass = (name: FieldName) =>
    `input-field ${errors[name] && touched[name] ? "border-red-700 focus:border-red-700" : ""}`;

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-white border border-line p-12 sm:p-20 text-center max-w-2xl w-full"
        >
          <div className="w-16 h-16 border border-line rounded-full flex items-center justify-center mx-auto mb-10">
            <svg className="w-7 h-7 text-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="eyebrow mb-6">Bedankt</p>
          <h1 className="display-md text-ink mb-6">Bestelling Bevestigd!</h1>
          <p className="body-lg text-slate mb-2">Bedankt voor je bestelling, {form.firstName}.</p>
          <p className="text-stone text-sm mb-12">Je ontvangt een bevestiging per e-mail.</p>
          <button onClick={() => router.push("/")} className="btn-primary">Terug naar Home</button>
        </motion.div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
        <AnimatedSection className="text-center max-w-xl">
          <p className="eyebrow mb-6">Afrekenen</p>
          <h1 className="display-md text-ink mb-6">Niets om af te rekenen</h1>
          <p className="body-lg text-slate mb-12">Je winkelwagen is leeg.</p>
          <button onClick={() => router.push("/products")} className="btn-primary">Producten Bekijken</button>
        </AnimatedSection>
      </div>
    );
  }

  const steps = [
    { n: "01", label: "Gegevens", active: true },
    { n: "02", label: "Betaling", active: false },
    { n: "03", label: "Bevestiging", active: false },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-32 lg:pt-40 pb-28 lg:pb-40">
      {/* Editorial header */}
      <AnimatedSection className="mb-12 lg:mb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-serif italic text-stone text-sm">— 02</span>
              <span className="eyebrow">Bijna Klaar</span>
            </div>
            <h1 className="display-lg text-ink">
              Afrekenen
            </h1>
          </div>
        </div>
      </AnimatedSection>

      {/* Stappen */}
      <AnimatedSection className="mb-16 lg:mb-20">
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {steps.map((step, i) => (
            <div key={step.n} className="flex items-center gap-6 sm:gap-10">
              <div className="flex items-center gap-3">
                <span className={`font-serif italic text-sm ${step.active ? "text-ink" : "text-stone"}`}>— {step.n}</span>
                <span className={`eyebrow ${step.active ? "!text-ink" : ""}`}>{step.label}</span>
              </div>
              {i < steps.length - 1 && <span className="w-10 sm:w-16 h-[1px] bg-line" />}
            </div>
          ))}
        </div>
      </AnimatedSection>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        <AnimatedSection direction="left" className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Contactgegevens */}
            <div className="bg-white border border-line p-8 lg:p-12">
              <span className="eyebrow">01</span>
              <h3 className="font-serif text-2xl text-ink mt-3 mb-10">Contactgegevens</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className="eyebrow block mb-3">Voornaam *</label>
                  <input type="text" name="firstName" value={form.firstName} onChange={handleChange} onBlur={handleBlur} required className={fieldClass("firstName")} aria-invalid={Boolean(errors.firstName && touched.firstName)} />
                  {errors.firstName && touched.firstName && <p className="text-[11px] text-red-700 mt-1.5">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="eyebrow block mb-3">Achternaam *</label>
                  <input type="text" name="lastName" value={form.lastName} onChange={handleChange} onBlur={handleBlur} required className={fieldClass("lastName")} aria-invalid={Boolean(errors.lastName && touched.lastName)} />
                  {errors.lastName && touched.lastName && <p className="text-[11px] text-red-700 mt-1.5">{errors.lastName}</p>}
                </div>
                <div>
                  <label className="eyebrow block mb-3">E-mail *</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} onBlur={handleBlur} required className={fieldClass("email")} aria-invalid={Boolean(errors.email && touched.email)} />
                  {errors.email && touched.email && <p className="text-[11px] text-red-700 mt-1.5">{errors.email}</p>}
                </div>
                <div>
                  <label className="eyebrow block mb-3">Telefoonnummer</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} onBlur={handleBlur} className={fieldClass("phone")} aria-invalid={Boolean(errors.phone && touched.phone)} />
                  {errors.phone && touched.phone && <p className="text-[11px] text-red-700 mt-1.5">{errors.phone}</p>}
                </div>
              </div>
            </div>

            {/* Verzendadres */}
            <div className="bg-white border border-line p-8 lg:p-12">
              <span className="eyebrow">02</span>
              <h3 className="font-serif text-2xl text-ink mt-3 mb-10">Verzendadres</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div className="sm:col-span-2 grid grid-cols-3 gap-x-8 gap-y-6">
                  <div className="col-span-2">
                    <label className="eyebrow block mb-3">Straatnaam *</label>
                    <input type="text" name="address" value={form.address} onChange={handleChange} onBlur={handleBlur} required className={fieldClass("address")} aria-invalid={Boolean(errors.address && touched.address)} />
                    {errors.address && touched.address && <p className="text-[11px] text-red-700 mt-1.5">{errors.address}</p>}
                  </div>
                  <div>
                    <label className="eyebrow block mb-3">Huisnr. *</label>
                    <input type="text" name="houseNumber" value={form.houseNumber} onChange={handleChange} onBlur={handleBlur} required className={fieldClass("houseNumber")} aria-invalid={Boolean(errors.houseNumber && touched.houseNumber)} />
                    {errors.houseNumber && touched.houseNumber && <p className="text-[11px] text-red-700 mt-1.5">{errors.houseNumber}</p>}
                  </div>
                </div>
                <div>
                  <label className="eyebrow block mb-3">Postcode *</label>
                  <input type="text" name="zipCode" value={form.zipCode} onChange={handleChange} onBlur={handleBlur} required className={fieldClass("zipCode")} placeholder="1234 AB" aria-invalid={Boolean(errors.zipCode && touched.zipCode)} />
                  {errors.zipCode && touched.zipCode && <p className="text-[11px] text-red-700 mt-1.5">{errors.zipCode}</p>}
                </div>
                <div>
                  <label className="eyebrow block mb-3">Stad *</label>
                  <input type="text" name="city" value={form.city} onChange={handleChange} onBlur={handleBlur} required className={fieldClass("city")} aria-invalid={Boolean(errors.city && touched.city)} />
                  {errors.city && touched.city && <p className="text-[11px] text-red-700 mt-1.5">{errors.city}</p>}
                </div>
              </div>
            </div>

            {/* Betaalmethode (demo) */}
            <div className="bg-white border border-line p-8 lg:p-12">
              <span className="eyebrow">03</span>
              <h3 className="font-serif text-2xl text-ink mt-3 mb-10">Betaalmethode</h3>
              <div className="space-y-4">
                <label className="flex items-center gap-4 p-5 border border-ink cursor-pointer transition-colors">
                  <input type="radio" name="payment" defaultChecked className="accent-bronze" />
                  <span className="text-ink text-sm font-medium">iDEAL</span>
                  <span className="text-stone text-xs ml-auto uppercase tracking-[0.2em]">Direct via je bank</span>
                </label>
                <label className="flex items-center gap-4 p-5 border border-line cursor-pointer hover:border-stone transition-colors">
                  <input type="radio" name="payment" className="accent-bronze" />
                  <span className="text-ink text-sm font-medium">Creditcard</span>
                  <span className="text-stone text-xs ml-auto uppercase tracking-[0.2em]">Visa, Mastercard</span>
                </label>
                <label className="flex items-center gap-4 p-5 border border-line cursor-pointer hover:border-stone transition-colors">
                  <input type="radio" name="payment" className="accent-bronze" />
                  <span className="text-ink text-sm font-medium">Bancontact</span>
                  <span className="text-stone text-xs ml-auto uppercase tracking-[0.2em]">Voor Belgische klanten</span>
                </label>
              </div>
              <p className="text-[11px] text-stone uppercase tracking-[0.2em] mt-6">Je wordt doorgestuurd naar een beveiligde betaalomgeving.</p>
            </div>

            <motion.button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50" whileTap={{ scale: 0.98 }}>
              {submitting ? "Verwerken..." : `Bestelling Plaatsen — \u20AC${total.toFixed(2)}`}
            </motion.button>
          </form>
        </AnimatedSection>

        {/* Samenvatting */}
        <AnimatedSection direction="right" className="lg:col-span-4">
          <div className="bg-white border border-line p-8 lg:p-10 sticky top-32">
            <span className="eyebrow">Overzicht</span>
            <h3 className="font-serif text-2xl text-ink mt-3 mb-8">Jouw Bestelling</h3>
            <div className="space-y-5 mb-8">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-4">
                  <div className="relative w-20 h-20 bg-bone flex-shrink-0 overflow-hidden">
                    {firstImageUrl(item.product.images) && <img src={firstImageUrl(item.product.images)!} alt={item.product.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-ink text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-stone text-[11px] uppercase tracking-[0.2em] mt-1">Aantal: {item.quantity}</p>
                    <p className="text-bronze text-sm font-medium mt-1">&euro;{(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line pt-5 space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate">Subtotaal</span>
                <span className="text-ink">&euro;{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Verzending</span>
                <span className="text-ink">{shipping === 0 ? "Gratis" : `\u20AC${shipping.toFixed(2)}`}</span>
              </div>
              <div className="border-t border-line pt-5 flex justify-between items-baseline">
                <span className="eyebrow">Totaal</span>
                <span className="font-serif text-2xl text-ink">&euro;{total.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-stone uppercase tracking-[0.2em]">Inclusief 21% BTW</p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
