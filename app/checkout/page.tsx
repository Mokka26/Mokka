"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import AnimatedSection from "@/components/AnimatedSection";
import { useCart, useCartSync, syncCart, announceCartChanges } from "@/context/CartContext";
import { shippingInfo, isEligibleForFreeShipping } from "@/lib/shipping-info";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { formatPrice } from "@/components/ui/price";
import { PaymentIconRow } from "@/components/PaymentIcons";
import { getCookieConsent } from "@/components/CookieBanner";
import { createCheckout, getPaymentMethods } from "./actions";
import { MobileOrderSummary, OrderSummaryLines } from "./OrderSummary";
import type { CheckoutMethod } from "@/lib/mollie";
import { trackAddPaymentInfo, trackAddShippingInfo, trackBeginCheckout } from "@/lib/analytics";

type Country = "NL" | "BE";

type FormFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  country: Country;
};
type FieldName = keyof FormFields;

const FIELD_ORDER: FieldName[] = ["firstName", "lastName", "email", "phone", "address", "houseNumber", "zipCode", "city", "country"];

const FIELD_LABEL: Record<FieldName, string> = {
  firstName: "Voornaam",
  lastName: "Achternaam",
  email: "E-mailadres",
  phone: "Telefoonnummer",
  address: "Straatnaam",
  houseNumber: "Huisnummer",
  zipCode: "Postcode",
  city: "Plaats",
  country: "Land",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTCODE_RE: Record<Country, RegExp> = {
  NL: /^\d{4}\s?[A-Za-z]{2}$/,
  BE: /^\d{4}$/,
};
const POSTCODE_HINT: Record<Country, string> = { NL: "Bijvoorbeeld 1234 AB", BE: "Bijvoorbeeld 1000" };
const PHONE_RE = /^[+\d\s()-]{7,20}$/;

function validateField(name: FieldName, value: string, country: Country): string | undefined {
  const v = value.trim();
  if (name === "country") return v === "NL" || v === "BE" ? undefined : "Kies Nederland of België";
  if (!v) return `Vul je ${FIELD_LABEL[name].toLowerCase()} in`;
  if (name === "email" && !EMAIL_RE.test(v)) return "Dit lijkt geen geldig e-mailadres";
  if (name === "phone" && !PHONE_RE.test(v)) return "Dit lijkt geen geldig telefoonnummer";
  if (name === "zipCode" && !POSTCODE_RE[country].test(v)) return `Ongeldige postcode. ${POSTCODE_HINT[country]}`;
  if ((name === "firstName" || name === "lastName") && v.length < 2) return "Minstens 2 tekens";
  return undefined;
}

function validateAll(form: FormFields): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  for (const name of FIELD_ORDER) {
    const e = validateField(name, form[name], form.country);
    if (e) errors[name] = e;
  }
  return errors;
}

/** gclid uit de URL (?gclid=) of de Google Ads-cookie `_gcl_aw` (GCL.<ts>.<id>). */
function readGclid(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("gclid");
    if (fromUrl) return fromUrl.slice(0, 200);
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("_gcl_aw="));
    if (!cookie) return null;
    const parts = decodeURIComponent(cookie.slice("_gcl_aw=".length)).split(".");
    return parts.length >= 3 ? parts.slice(2).join(".").slice(0, 200) : null;
  } catch {
    return null;
  }
}

/** Eén sleutel per paginabezoek: een tweede klik (of retry) maakt geen tweede order. */
function makeIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Oude WebView zonder randomUUID: zonder sleutel verder (server accepteert optioneel).
    return "";
  }
}

const NETWORK_FAILED = "Controleer je internetverbinding en probeer het opnieuw. Er is nog niets afgeschreven.";

export default function CheckoutPage() {
  const { items, totalPrice } = useCart();
  // Prijzen/voorraad verversen tegen de server vóór het afrekenen.
  useCartSync();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormFields>({
    firstName: "", lastName: "", email: "", phone: "", address: "", houseNumber: "", zipCode: "", city: "", country: "NL",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [showSummary, setShowSummary] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Anti-spam: honeypot (`website` blijft leeg) + door de client gemeten
  // invultijd (`elapsedMs`, performance.now() sinds mount — klokonafhankelijk).
  const [website, setWebsite] = useState("");
  const mountedAtRef = useRef<number | null>(null);
  const gclidRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef<string>("");
  useEffect(() => {
    mountedAtRef.current = performance.now();
    gclidRef.current = readGclid();
    idempotencyKeyRef.current = makeIdempotencyKey();
  }, []);

  // bfcache: komt de klant met "terug" van de betaalpagina, dan wordt deze
  // pagina uit het geheugen hersteld mét `submitting=true`. Resetten, anders
  // blijft de knop voor altijd op "Even geduld…".
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // GA4 begin_checkout: één keer zodra de wagen uit localStorage is gehydrateerd
  // (de CartProvider-effect draait ná dit effect, dus niet simpelweg bij mount).
  const beginTrackedRef = useRef(false);
  useEffect(() => {
    if (beginTrackedRef.current || items.length === 0) return;
    beginTrackedRef.current = true;
    trackBeginCheckout(items, totalPrice);
  }, [items, totalPrice]);

  const freeShipping = isEligibleForFreeShipping(totalPrice, form.country);
  const shipping = freeShipping ? 0 : shippingInfo.rates.standard;
  const total = totalPrice + shipping;
  const totals = { subtotal: totalPrice, shipping, total };
  const phoneLink = getPhoneLink();

  const [methods, setMethods] = useState<CheckoutMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("");

  // Haal de in Mollie ingeschakelde betaalmethoden op voor dit bedrag.
  useEffect(() => {
    if (!(total > 0)) return;
    let active = true;
    const load = async () => {
      let m: CheckoutMethod[] = [];
      try {
        m = await getPaymentMethods(total, form.country);
      } catch {
        // Netwerkfout: lijst blijft leeg; de server valt bij het afrekenen
        // terug op de standaardmethode.
        return;
      }
      if (!active) return;
      setMethods(m);
      setSelectedMethod((cur) => (cur && m.some((x) => x.id === cur) ? cur : m[0]?.id ?? ""));
    };
    void load();
    return () => { active = false; };
  }, [total, form.country]);

  const setField = (name: FieldName, value: string) => {
    const next = { ...form, [name]: value } as FormFields;
    setForm(next);
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value, next.country) }));
    }
    // Landwissel → postcode opnieuw beoordelen.
    if (name === "country" && touched.zipCode) {
      setErrors((prev) => ({ ...prev, zipCode: validateField("zipCode", next.zipCode, next.country) }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setField(e.target.name as FieldName, e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as FieldName;
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, form[name], form.country) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Dubbele submit (Enter + klik) negeren zolang de vorige loopt.
    if (submitting) return;
    const allErrors = validateAll(form);
    setErrors(allErrors);
    setTouched(Object.fromEntries(FIELD_ORDER.map((n) => [n, true])));
    if (Object.keys(allErrors).length > 0) {
      setShowSummary(true);
      // Focus de samenvatting zodat screenreaders de fouten horen.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setShowSummary(false);
    setSubmitting(true);
    // GA4 funnel: bezorggegevens + betaalmethode zijn op deze ene pagina
    // ingevuld; beide events vuren bij een geldige submit, vóór de redirect.
    trackAddShippingInfo(items, totalPrice, freeShipping ? "gratis" : "standaard");
    trackAddPaymentInfo(items, totalPrice, selectedMethod);

    const elapsedMs = mountedAtRef.current == null ? undefined : Math.round(performance.now() - mountedAtRef.current);
    let redirecting = false;
    try {
      const result = await createCheckout({
        customer: {
          firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone,
          address: form.address, houseNumber: form.houseNumber, city: form.city, zipCode: form.zipCode,
          country: form.country,
        },
        expectedTotal: totalPrice,
        ...(selectedMethod ? { method: selectedMethod } : {}),
        items: items.map((i) => ({
          productId: i.productId,
          variantLabel: i.variantLabel,
          nachtkast: i.nachtkast,
          voetbank: i.voetbank,
          quantity: i.quantity,
        })),
        website,
        ...(elapsedMs === undefined ? {} : { elapsedMs }),
        ...(idempotencyKeyRef.current ? { idempotencyKey: idempotencyKeyRef.current } : {}),
        analyticsConsent: getCookieConsent() === "accepted",
        ...(gclidRef.current ? { gclid: gclidRef.current } : {}),
      });
      if (result.ok) {
        // Door naar de beveiligde Mollie-betaalpagina; knop blijft geblokkeerd.
        redirecting = true;
        window.location.href = result.url;
        return;
      }
      if (result.error === "PRICE_CHANGED") {
        // Prijs gewijzigd sinds toevoegen: wagen verversen, melden, niet blokkeren.
        const changes = await syncCart();
        announceCartChanges(changes);
        toast.info(result.message, { duration: 8000 });
        return;
      }
      toast.error("Betaling starten mislukt", { description: result.message || result.error, duration: 8000 });
    } catch {
      // Netwerk weggevallen of server onbereikbaar: UI herstellen, klant kan opnieuw.
      toast.error("Betaling starten mislukt", { description: NETWORK_FAILED, duration: 8000 });
    } finally {
      if (!redirecting) setSubmitting(false);
    }
  };

  const hasError = (name: FieldName) => Boolean(errors[name] && touched[name]);
  const errorId = (name: FieldName) => `co-${name}-err`;
  const fieldClass = (name: FieldName) =>
    `input-field ${hasError(name) ? "border-error focus-visible:border-error" : ""}`;
  const summaryErrors = FIELD_ORDER.filter((n) => errors[n]).map((n) => ({ name: n, message: errors[n] as string }));

  if (items.length === 0) {
    return (
      <div className="min-h-[80dvh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
        <AnimatedSection className="text-center max-w-xl">
          <h1 className="display-md text-ink mb-6">Niets om af te rekenen</h1>
          <p className="body-lg text-slate mb-12">Je winkelwagen is leeg.</p>
          <button type="button" onClick={() => router.push("/banken")} className="btn-primary">Bekijk collectie</button>
        </AnimatedSection>
      </div>
    );
  }

  // Render-functie (géén component): een component-definitie binnen de
  // pagina zou bij elke toetsaanslag remounten en de focus verliezen.
  const renderField = ({
    name, type = "text", autoComplete, inputMode, placeholder, className = "", hint,
  }: {
    name: Exclude<FieldName, "country">;
    type?: string;
    autoComplete: string;
    inputMode?: "text" | "numeric" | "tel" | "email";
    placeholder?: string;
    className?: string;
    hint?: string;
  }) => {
    const hintId = hint ? `co-${name}-hint` : undefined;
    const describedBy = [hasError(name) ? errorId(name) : null, hintId].filter(Boolean).join(" ") || undefined;
    return (
      <div className={`min-w-0 ${className}`}>
        <label htmlFor={`co-${name}`} className="block text-base text-ink mb-2">
          {FIELD_LABEL[name]}
        </label>
        <input
          type={type}
          id={`co-${name}`}
          name={name}
          value={form[name]}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          className={fieldClass(name)}
          aria-invalid={hasError(name) || undefined}
          aria-describedby={describedBy}
        />
        {hint && <p id={hintId} className="text-[14px] text-stone mt-1.5">{hint}</p>}
        {hasError(name) && (
          <p id={errorId(name)} className="text-[14px] text-error mt-1.5">{errors[name]}</p>
        )}
      </div>
    );
  };

  const fieldsetClass = "bg-white border border-line rounded-[10px] p-5 sm:p-8 lg:p-12";

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-32 lg:pt-40 pb-28 lg:pb-40">
      {/* Editorial header */}
      <AnimatedSection className="mb-10 lg:mb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <h1 className="display-lg text-ink">Afrekenen</h1>
            <p className="body-lg text-slate mt-6 max-w-xl">
              Bijna klaar: je gegevens en betaling op één pagina. Een account is niet nodig.
            </p>
          </div>
        </div>
      </AnimatedSection>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        <AnimatedSection direction="left" className="lg:col-span-8 min-w-0">
          {/* Mobiel/tablet: bestelling inklapbaar bóven het formulier (op lg staat de kaart ernaast). */}
          <MobileOrderSummary items={items} totals={totals} />

          {showSummary && summaryErrors.length > 0 && (
            <div
              ref={summaryRef}
              role="alert"
              tabIndex={-1}
              className="mb-8 border border-error rounded-[10px] bg-white p-5 sm:p-6"
            >
              <h2 className="text-base font-medium text-error mb-3">
                Controleer {summaryErrors.length === 1 ? "dit veld" : `deze ${summaryErrors.length} velden`}
              </h2>
              <ul className="space-y-1.5 text-[15px] text-ink">
                {summaryErrors.map((err) => (
                  <li key={err.name}>
                    <a href={`#co-${err.name}`} className="underline underline-offset-4 hover:text-accent">
                      {FIELD_LABEL[err.name]}
                    </a>
                    : {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-8 lg:space-y-10">
            {/* Honeypot — voor mensen onzichtbaar, bots vullen 'm in. */}
            <div className="hp-field" aria-hidden="true">
              <label htmlFor="co-website">Website</label>
              <input
                type="text"
                id="co-website"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Contactgegevens */}
            <fieldset className={fieldsetClass}>
              <legend className="sr-only">Contactgegevens</legend>
              <h2 className="font-serif text-2xl text-ink mb-6 sm:mb-8">Contactgegevens</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                {renderField({ name: "firstName", autoComplete: "given-name" })}
                {renderField({ name: "lastName", autoComplete: "family-name" })}
                {renderField({ name: "email", type: "email", autoComplete: "email", inputMode: "email" })}
                {renderField({ name: "phone", type: "tel", autoComplete: "tel", inputMode: "tel", hint: "Voor de bezorgafspraak van je meubels." })}
              </div>
            </fieldset>

            {/* Verzendadres */}
            <fieldset className={fieldsetClass}>
              <legend className="sr-only">Bezorgadres</legend>
              <h2 className="font-serif text-2xl text-ink mb-6 sm:mb-8">Bezorgadres</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label htmlFor="co-country" className="block text-base text-ink mb-2">{FIELD_LABEL.country}</label>
                  <select
                    id="co-country"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoComplete="country"
                    className={`${fieldClass("country")} min-h-11 cursor-pointer`}
                    aria-invalid={hasError("country") || undefined}
                    aria-describedby={hasError("country") ? errorId("country") : undefined}
                  >
                    <option value="NL">Nederland</option>
                    <option value="BE">België</option>
                  </select>
                  {hasError("country") && (
                    <p id={errorId("country")} className="text-[14px] text-error mt-1.5">{errors.country}</p>
                  )}
                </div>
                <div className="hidden sm:block" aria-hidden="true" />
                {/* Straat + huisnummer: < 400px onder elkaar, daarboven naast elkaar met een smal nummerveld. */}
                <div className="sm:col-span-2 grid grid-cols-1 min-[400px]:grid-cols-[minmax(0,1fr)_5.5rem] sm:grid-cols-[minmax(0,1fr)_9rem] gap-x-4 sm:gap-x-8 gap-y-6">
                  {renderField({ name: "address", autoComplete: "address-line1" })}
                  {renderField({ name: "houseNumber", autoComplete: "off", inputMode: "numeric", placeholder: "12a" })}
                </div>
                {renderField({
                  name: "zipCode",
                  autoComplete: "postal-code",
                  inputMode: form.country === "BE" ? "numeric" : "text",
                  placeholder: form.country === "BE" ? "1000" : "1234 AB",
                })}
                {renderField({ name: "city", autoComplete: "address-level2" })}
              </div>
            </fieldset>

            {/* Betaalmethode — live uit Mollie (/v2/methods) */}
            <fieldset className={fieldsetClass}>
              <legend className="sr-only">Betaalmethode</legend>
              <h2 className="font-serif text-2xl text-ink mb-6 sm:mb-8">Betaalmethode</h2>
              <div className="space-y-3">
                {methods.length === 0 && (
                  <p className="text-base text-stone" aria-live="polite">Betaalmethoden laden…</p>
                )}
                {methods.map((m) => {
                  const active = selectedMethod === m.id;
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-4 p-4 min-h-14 border rounded-[10px] cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2 ${
                        active ? "border-ink bg-paper" : "border-line hover:border-stone"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={m.id}
                        checked={active}
                        onChange={() => setSelectedMethod(m.id)}
                        className="accent-accent w-4 h-4"
                      />
                      {m.image ? (
                        <Image src={m.image} alt="" width={40} height={26} unoptimized className="h-6 w-auto" />
                      ) : (
                        <span className="w-10" aria-hidden="true" />
                      )}
                      <span className="text-ink text-base font-medium">{m.description}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[14px] text-stone mt-6">Je rondt de betaling af in de beveiligde omgeving van onze betaalpartner.</p>
            </fieldset>

            {/* Bestellen */}
            <div className="space-y-5">
              {/* Totaal nog eens vlak boven de knop (de kaart staat op mobiel ingeklapt bovenaan). */}
              <div className="lg:hidden flex items-baseline justify-between gap-4 border-t border-line pt-5">
                <span className="text-base text-ink">
                  Totaal <span className="text-slate">({shippingInfo.vatLabelShort})</span>
                </span>
                <span className="font-serif text-2xl text-ink tabular-nums">{formatPrice(total)}</span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting || undefined}
                className="btn-primary w-full min-h-12 !px-4 sm:!px-8 !text-base !normal-case !tracking-normal disabled:cursor-not-allowed"
              >
                {submitting ? "Even geduld…" : `Bestellen en betalen — ${formatPrice(total)}`}
              </button>
              <p className="text-[14px] text-slate leading-relaxed">
                Met je bestelling ga je akkoord met onze{" "}
                <Link href={businessInfo.legal.termsUrl} className="underline underline-offset-4 hover:text-accent">
                  algemene voorwaarden
                </Link>{" "}
                en{" "}
                <Link href={businessInfo.legal.privacyPolicyUrl} className="underline underline-offset-4 hover:text-accent">
                  privacyverklaring
                </Link>
                .
              </p>
              <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-[14px] text-ink">
                <li>{freeShipping ? "Gratis verzending" : `${shippingInfo.freeShippingCopyShort}`}</li>
                <li>Levertijd {shippingInfo.deliveryTime.inStock}</li>
                <li>
                  {shippingInfo.returnWindowDays} dagen bedenktijd —{" "}
                  <Link href={businessInfo.legal.returnPolicyUrl} className="underline underline-offset-4 hover:text-accent">
                    retourneren
                  </Link>
                </li>
                {phoneLink && businessInfo.contact.phoneFormatted && (
                  <li>
                    Vragen? Bel{" "}
                    <a href={phoneLink} className="underline underline-offset-4 hover:text-accent whitespace-nowrap">
                      {businessInfo.contact.phoneFormatted}
                    </a>
                  </li>
                )}
              </ul>
              <PaymentIconRow />
            </div>
          </form>
        </AnimatedSection>

        {/* Samenvatting — alleen lg+ (op kleinere schermen staat hij ingeklapt boven het formulier) */}
        <AnimatedSection direction="right" className="hidden lg:block lg:col-span-4">
          <div className="bg-white border border-line rounded-[10px] p-8 lg:p-10 sticky top-32">
            <h2 className="font-serif text-2xl text-ink mb-8">Je bestelling</h2>
            <OrderSummaryLines items={items} totals={totals} />
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
