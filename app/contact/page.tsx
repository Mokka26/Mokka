"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Phone, MapPin, Clock, Check } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/Button";
import { submitContact } from "./actions";
import {
  businessInfo,
  getMapsUrl,
  getOpeningHoursCompact,
  getPhoneLink,
  getEmailLink,
} from "@/lib/business-info";

type FormState = { name: string; email: string; phone: string; subject: string; message: string };
type FieldKey = keyof FormState;
type FieldErrors = Partial<Record<FieldKey, string>>;

const SUBJECT_OPTIONS = [
  { value: "product", label: "Vraag over een product" },
  { value: "bestelling", label: "Vraag over een bestelling" },
  { value: "retour", label: "Retour of ruil" },
  { value: "advies", label: "Interieuradvies" },
  { value: "anders", label: "Anders" },
];

// Het onderwerp-veld op de server accepteert max. 60 tekens.
const SUBJECT_MAX = 60;

function productSubject(slug: string): string {
  return `Prijs en levertijd aanvragen voor ${slug}`.slice(0, SUBJECT_MAX);
}

function cleanSlug(param: string | null): string | null {
  const slug = param?.toLowerCase().replace(/[^a-z0-9-]/g, "") ?? "";
  return slug || null;
}

function initialForm(productSlug: string | null): FormState {
  return {
    name: "",
    email: "",
    phone: "",
    subject: productSlug ? productSubject(productSlug) : "",
    message: productSlug ? `Ik wil graag de prijs en levertijd weten van: ${productSlug}\n\n` : "",
  };
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.name.trim().length < 2) errors.name = "Vul je naam in.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = "Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.";
  if (!form.subject) errors.subject = "Kies een onderwerp.";
  if (form.message.trim().length < 5) errors.message = "Schrijf een bericht van minimaal een paar woorden.";
  return errors;
}

function ContactForm() {
  // ?product=<slug> vanaf een productpagina → onderwerp en bericht voorvullen.
  const searchParams = useSearchParams();
  const productSlug = cleanSlug(searchParams.get("product"));

  const [form, setForm] = useState<FormState>(() => initialForm(productSlug));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Anti-spam: honeypot (moet leeg blijven) + tijdstempel van het laden.
  const [website, setWebsite] = useState("");
  const startedAtRef = useRef<HTMLInputElement>(null);

  const statusRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>>({});

  // Tijdstempel bij mount in het (uncontrolled) verborgen veld — geen state,
  // dus geen hydration-verschil tussen server en client.
  useEffect(() => {
    if (startedAtRef.current) startedAtRef.current.value = String(Date.now());
  }, []);

  // Succes- of foutmelding krijgt focus zodat ook schermlezers hem horen.
  useEffect(() => {
    if (submitted || error) statusRef.current?.focus();
  }, [submitted, error]);

  const phoneLink = getPhoneLink();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const key = e.target.name as FieldKey;
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (fieldErrors[key]) setFieldErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const first = (Object.keys(errors) as FieldKey[])[0];
      fieldRefs.current[first]?.focus();
      return;
    }

    setSending(true);
    // Tijdstempel (ms-epoch) van het moment dat het formulier verscheen (anti-spam).
    const startedAt = Number.parseInt(startedAtRef.current?.value ?? "", 10);
    const r = await submitContact({
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      subject: form.subject || undefined,
      message: form.message,
      website,
      startedAt: Number.isFinite(startedAt) ? startedAt : undefined,
    });
    setSending(false);
    if (r.ok) {
      setSubmitted(true);
      return;
    }
    setError(r.error ?? "Er ging iets mis. Probeer het opnieuw of bel ons.");
  };

  const describedBy = (key: FieldKey) => (fieldErrors[key] ? `contact-${key}-error` : undefined);

  if (submitted) {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        className="bg-white border border-line p-10 lg:p-16 text-center focus:outline-none"
      >
        <div className="w-16 h-16 border border-line rounded-full flex items-center justify-center mx-auto mb-8">
          <Check className="w-7 h-7 text-success" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <p className="eyebrow mb-4">Verzonden</p>
        <h2 className="display-md text-ink mb-4">Bedankt voor je bericht</h2>
        <p className="body-lg text-slate">
          We reageren zo snel mogelijk, meestal binnen één werkdag. Haast? Bel ons dan tijdens openingstijden
          {businessInfo.contact.phoneFormatted && phoneLink ? (
            <>
              {" "}op{" "}
              <a href={phoneLink} className="text-ink underline underline-offset-2">
                {businessInfo.contact.phoneFormatted}
              </a>
            </>
          ) : null}
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="bg-white border border-line p-6 sm:p-8 lg:p-12 space-y-7">
      <div>
        <p className="eyebrow">Schrijf ons</p>
        <h2 className="font-serif text-2xl text-ink mt-2">Stuur een bericht</h2>
        <p className="text-base text-slate mt-2">Velden met een * zijn verplicht.</p>
      </div>

      {error && (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="alert"
          className="text-base text-error bg-paper border border-error px-4 py-3 rounded-[8px] focus:outline-none"
        >
          {error}
        </div>
      )}

      {/* Honeypot: mensen zien dit veld niet; bots vullen het wél in. */}
      <div className="hp-field" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <input ref={startedAtRef} type="hidden" name="startedAt" defaultValue="" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
        <div className="field-group">
          <label htmlFor="contact-name" className="field-label">Naam *</label>
          <input
            ref={(el) => { fieldRefs.current.name = el; }}
            id="contact-name"
            type="text"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            required
            aria-required="true"
            aria-invalid={fieldErrors.name ? "true" : undefined}
            aria-describedby={describedBy("name")}
            className="input-field"
          />
          {fieldErrors.name && <p id="contact-name-error" className="input-error">{fieldErrors.name}</p>}
        </div>
        <div className="field-group">
          <label htmlFor="contact-phone" className="field-label">Telefoon</label>
          <input
            id="contact-phone"
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={handleChange}
            className="input-field"
          />
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="contact-email" className="field-label">E-mail *</label>
        <input
          ref={(el) => { fieldRefs.current.email = el; }}
          id="contact-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={handleChange}
          required
          aria-required="true"
          aria-invalid={fieldErrors.email ? "true" : undefined}
          aria-describedby={describedBy("email")}
          className="input-field"
        />
        {fieldErrors.email && <p id="contact-email-error" className="input-error">{fieldErrors.email}</p>}
      </div>

      <div className="field-group">
        <label htmlFor="contact-subject" className="field-label">Onderwerp *</label>
        <select
          ref={(el) => { fieldRefs.current.subject = el; }}
          id="contact-subject"
          name="subject"
          value={form.subject}
          onChange={handleChange}
          required
          aria-required="true"
          aria-invalid={fieldErrors.subject ? "true" : undefined}
          aria-describedby={describedBy("subject")}
          className="input-field"
        >
          <option value="">Kies een onderwerp</option>
          {productSlug && (
            <option value={productSubject(productSlug)}>{productSubject(productSlug)}</option>
          )}
          {SUBJECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {fieldErrors.subject && <p id="contact-subject-error" className="input-error">{fieldErrors.subject}</p>}
      </div>

      <div className="field-group">
        <label htmlFor="contact-message" className="field-label">Bericht *</label>
        <textarea
          ref={(el) => { fieldRefs.current.message = el; }}
          id="contact-message"
          name="message"
          value={form.message}
          onChange={handleChange}
          required
          aria-required="true"
          aria-invalid={fieldErrors.message ? "true" : undefined}
          aria-describedby={describedBy("message")}
          rows={6}
          className="input-field resize-y"
        />
        {fieldErrors.message && <p id="contact-message-error" className="input-error">{fieldErrors.message}</p>}
      </div>

      <Button type="submit" disabled={sending} className="w-full">
        {sending ? "Bezig met versturen…" : "Verstuur bericht"}
      </Button>
      <p className="text-sm text-slate">
        Je gegevens gebruiken we alleen om je vraag te beantwoorden. Lees ons{" "}
        <a href={businessInfo.legal.privacyPolicyUrl} className="underline underline-offset-2 text-ink">privacybeleid</a>.
      </p>
    </form>
  );
}

export default function ContactPage() {
  const phoneLink = getPhoneLink();
  const emailLink = getEmailLink();
  const hours = getOpeningHoursCompact();

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-32 lg:pt-40 pb-28 lg:pb-40">
      {/* Kop */}
      <AnimatedSection className="mb-16 lg:mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end">
          <div className="lg:col-span-8">
            <p className="eyebrow mb-6">Neem contact op</p>
            <h1 className="display-xl text-ink">Contact</h1>
          </div>
          <div className="lg:col-span-4">
            <p className="body-lg text-slate">
              Een vraag over een product, hulp bij een bestelling of advies over je interieur? Bel, mail of kom langs in de showroom. We denken graag met je mee.
            </p>
          </div>
        </div>
      </AnimatedSection>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        {/* Gegevens — bron: lib/business-info.ts */}
        <AnimatedSection direction="left" className="lg:col-span-5">
          <div className="border-t border-line pt-10">
            <p className="eyebrow">Bereikbaar</p>
            <h2 className="display-md text-ink mt-4 mb-10">
              We horen graag <span className="italic text-stone">van je</span>
            </h2>

            <ul className="space-y-8 list-none m-0 p-0">
              {phoneLink && businessInfo.contact.phoneFormatted && (
                <li className="flex items-start gap-5">
                  <Phone className="w-5 h-5 text-accent-dark flex-shrink-0 mt-1" strokeWidth={1.5} aria-hidden="true" />
                  <div>
                    <p className="eyebrow mb-1">Telefoon</p>
                    <a
                      href={phoneLink}
                      className="inline-flex items-center min-h-11 font-serif text-xl text-ink hover:text-accent-dark transition-colors"
                      aria-label={`Bel ons: ${businessInfo.contact.phoneFormatted}`}
                    >
                      {businessInfo.contact.phoneFormatted}
                    </a>
                    <p className="text-base text-slate">Tijdens openingstijden van de showroom.</p>
                  </div>
                </li>
              )}

              {emailLink && (
                <li className="flex items-start gap-5">
                  <Mail className="w-5 h-5 text-accent-dark flex-shrink-0 mt-1" strokeWidth={1.5} aria-hidden="true" />
                  <div>
                    <p className="eyebrow mb-1">E-mail</p>
                    <a
                      href={emailLink}
                      className="inline-flex items-center min-h-11 font-serif text-xl text-ink hover:text-accent-dark transition-colors break-all"
                    >
                      {businessInfo.contact.email}
                    </a>
                    <p className="text-base text-slate">We reageren zo snel mogelijk, meestal binnen één werkdag.</p>
                  </div>
                </li>
              )}

              <li className="flex items-start gap-5">
                <MapPin className="w-5 h-5 text-accent-dark flex-shrink-0 mt-1" strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <p className="eyebrow mb-1">Showroom</p>
                  <a
                    href={getMapsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-serif text-xl text-ink leading-snug hover:text-accent-dark transition-colors py-1"
                  >
                    {businessInfo.address.street}<br />
                    {businessInfo.address.postalCode} {businessInfo.address.city}
                    <span className="sr-only"> (opent in Google Maps, nieuw venster)</span>
                  </a>
                  <p className="text-base text-slate">Kom langs om proef te zitten.</p>
                </div>
              </li>

              <li className="flex items-start gap-5">
                <Clock className="w-5 h-5 text-accent-dark flex-shrink-0 mt-1" strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <p className="eyebrow mb-1">Openingstijden</p>
                  <dl className="font-serif text-xl text-ink leading-snug">
                    {hours.map((line) => {
                      const [days, ...rest] = line.split(" ");
                      return (
                        <div key={line} className="flex gap-3">
                          <dt className="min-w-[4.5rem]">{days}</dt>
                          <dd>{rest.join(" ")}</dd>
                        </div>
                      );
                    })}
                    {!businessInfo.openingHours.sunday && (
                      <div className="flex gap-3">
                        <dt className="min-w-[4.5rem]">Zo</dt>
                        <dd>Gesloten</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </li>
            </ul>
          </div>
        </AnimatedSection>

        {/* Formulier — useSearchParams vereist een Suspense-grens */}
        <AnimatedSection direction="right" className="lg:col-span-7">
          <Suspense fallback={<div className="bg-white border border-line p-8 lg:p-12 min-h-[32rem]" aria-busy="true" />}>
            <ContactForm />
          </Suspense>
        </AnimatedSection>
      </div>
    </div>
  );
}
