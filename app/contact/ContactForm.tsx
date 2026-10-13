"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { submitContact } from "./actions";
import { businessInfo, getPhoneLink } from "@/lib/business-info";

type FormState = { name: string; email: string; phone: string; subject: string; message: string };
type FieldKey = keyof FormState;
type FieldErrors = Partial<Record<FieldKey, string>>;

const SUBJECT_OPTIONS = [
  { value: "product", label: "Vraag over een product" },
  { value: "bestelling", label: "Vraag over een bestelling" },
  { value: "showroom", label: "Showroomafspraak" },
  { value: "retour", label: "Retour of ruil" },
  { value: "advies", label: "Interieuradvies" },
  { value: "anders", label: "Anders" },
];

// Het onderwerp-veld op de server accepteert max. 60 tekens.
const SUBJECT_MAX = 60;

const NETWORK_FAILED = "Versturen is niet gelukt. Controleer je internetverbinding en probeer het opnieuw, of bel ons.";

function productSubject(slug: string): string {
  return `Prijs en levertijd aanvragen voor ${slug}`.slice(0, SUBJECT_MAX);
}

function cleanSlug(param: string | null): string | null {
  const slug = param?.toLowerCase().replace(/[^a-z0-9-]/g, "") ?? "";
  return slug || null;
}

/** `?subject=showroom` (vanaf de showroompagina) → onderwerp voorselecteren. */
function presetSubject(param: string | null): string {
  const value = param?.toLowerCase() ?? "";
  return SUBJECT_OPTIONS.some((o) => o.value === value) ? value : "";
}

function initialForm(productSlug: string | null, subject: string): FormState {
  if (productSlug) {
    return {
      name: "",
      email: "",
      phone: "",
      subject: productSubject(productSlug),
      message: `Ik wil graag de prijs en levertijd weten van: ${productSlug}\n\n`,
    };
  }
  return {
    name: "",
    email: "",
    phone: "",
    subject,
    message: subject === "showroom" ? "Ik wil graag een afspraak maken om in de showroom te komen kijken.\n\n" : "",
  };
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.name.trim().length < 2) errors.name = "Vul je naam in.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = "Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.";
  if (form.phone.trim() && !/^[0-9+\s-]{6,30}$/.test(form.phone.trim())) errors.phone = "Dit lijkt geen geldig telefoonnummer. Gebruik alleen cijfers, spaties, + en -.";
  if (!form.subject) errors.subject = "Kies een onderwerp.";
  if (form.message.trim().length < 5) errors.message = "Schrijf een bericht van minimaal een paar woorden.";
  return errors;
}

/**
 * Contactformulier (client). Vereist een Suspense-grens in de ouder vanwege
 * useSearchParams. Stuurt naar submitContact: name, email, phone (optioneel),
 * subject, message, website (honeypot) en elapsedMs (invultijd).
 */
export default function ContactForm() {
  // ?product=<slug> vanaf een productpagina → onderwerp en bericht voorvullen;
  // ?subject=showroom vanaf de showroompagina → "Showroomafspraak".
  const searchParams = useSearchParams();
  const productSlug = cleanSlug(searchParams.get("product"));
  const subjectParam = presetSubject(searchParams.get("subject"));

  const [form, setForm] = useState<FormState>(() => initialForm(productSlug, subjectParam));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Anti-spam: honeypot (moet leeg blijven) + invultijd gemeten sinds mount.
  const [website, setWebsite] = useState("");
  const mountedAtRef = useRef<number | null>(null);

  const statusRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>>({});

  // Starttijd met performance.now(): klok-onafhankelijk, geen hydration-verschil.
  useEffect(() => {
    mountedAtRef.current = performance.now();
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
    if (sending) return;
    setError(null);

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const first = (Object.keys(errors) as FieldKey[])[0];
      fieldRefs.current[first]?.focus();
      return;
    }

    setSending(true);
    const elapsedMs = mountedAtRef.current == null ? undefined : Math.round(performance.now() - mountedAtRef.current);
    try {
      const r = await submitContact({
        name: form.name,
        email: form.email,
        phone: form.phone.trim() || undefined,
        subject: form.subject || undefined,
        message: form.message,
        website,
        ...(elapsedMs === undefined ? {} : { elapsedMs }),
      });
      if (r.ok) {
        setSubmitted(true);
        return;
      }
      setError(r.error ?? "Er ging iets mis. Probeer het opnieuw of bel ons.");
    } catch {
      // Netwerk weggevallen of server onbereikbaar: formulier blijft ingevuld.
      setError(NETWORK_FAILED);
    } finally {
      setSending(false);
    }
  };

  const describedBy = (key: FieldKey) => (fieldErrors[key] ? `contact-${key}-error` : undefined);

  if (submitted) {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        className="bg-white border border-line p-6 sm:p-10 lg:p-16 text-center focus:outline-none"
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
    <form onSubmit={handleSubmit} noValidate className="bg-white border border-line p-5 sm:p-8 lg:p-12 space-y-7">
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
          <label htmlFor="contact-phone" className="field-label">Telefoon (optioneel)</label>
          <input
            ref={(el) => { fieldRefs.current.phone = el; }}
            id="contact-phone"
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={handleChange}
            aria-invalid={fieldErrors.phone ? "true" : undefined}
            aria-describedby={describedBy("phone")}
            className="input-field"
          />
          {fieldErrors.phone && <p id="contact-phone-error" className="input-error">{fieldErrors.phone}</p>}
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

      <Button type="submit" disabled={sending} aria-busy={sending || undefined} className="w-full min-h-12">
        {sending ? "Bezig met versturen…" : "Verstuur bericht"}
      </Button>
      <p className="text-[14px] text-slate">
        Je gegevens gebruiken we alleen om je vraag te beantwoorden. Lees ons{" "}
        <a href={businessInfo.legal.privacyPolicyUrl} className="underline underline-offset-2 text-ink">privacybeleid</a>.
      </p>
    </form>
  );
}
