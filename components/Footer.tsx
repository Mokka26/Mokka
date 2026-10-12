"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { subscribeNewsletter } from "@/app/newsletter/actions";
import {
  businessInfo,
  getEmailLink,
  getPhoneLink,
  getMapsUrl,
  getOpeningHoursCompact,
  getActiveSocials,
} from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { CATEGORIES, GROUP_ORDER, categoryUrl } from "@/lib/categories";
import { PaymentIcon } from "@/components/PaymentIcons";
import type { CheckoutMethod } from "@/lib/mollie";

// Shop-kolommen: per groep de umbrella (als die er is) als kop-link plus alle
// niet-umbrella categorieën. Eén bron: lib/categories.ts.
const shopGroups = GROUP_ORDER.map((group) => {
  const inGroup = CATEGORIES.filter((c) => c.group === group);
  const umbrella = inGroup.find((c) => c.isUmbrella);
  return {
    group,
    umbrellaHref: umbrella ? categoryUrl(umbrella.slug) : null,
    links: inGroup.filter((c) => !c.isUmbrella).map((c) => ({ label: c.label, href: categoryUrl(c.slug) })),
  };
});

const footerHeading = "text-[13px] uppercase tracking-[0.2em] text-white/70 mb-5";
const footerLink = "text-white/85 hover:text-white underline-offset-4 hover:underline transition-colors";

export default function Footer({ mollieMethods = [] }: { mollieMethods?: CheckoutMethod[] }) {
  const pathname = usePathname();

  // Hooks MOETEN vóór elke conditionele return (Rules of Hooks) — anders crasht
  // client-navigatie shop → /admin met "Rendered fewer hooks than expected".
  const [nlEmail, setNlEmail] = useState("");
  const [nlStatus, setNlStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [nlMsg, setNlMsg] = useState("");
  const [nlWebsite, setNlWebsite] = useState(""); // honeypot — blijft leeg bij mensen
  const nlStartedAtRef = useRef<HTMLInputElement>(null);

  // Tijdstempel bij mount in een uncontrolled verborgen veld (anti-spam).
  useEffect(() => {
    if (nlStartedAtRef.current) nlStartedAtRef.current.value = String(Date.now());
  }, []);

  if (pathname?.startsWith("/admin")) return null;

  const phoneLink = getPhoneLink();
  const emailLink = getEmailLink();
  const socials = getActiveSocials();
  const hoursLines = getOpeningHoursCompact();
  const { address, foundingYear, foundingCity, kvk, btw, legalName, name, tagline, paymentMethods, legal } = businessInfo;

  async function handleNewsletter(e: React.FormEvent) {
    e.preventDefault();
    setNlStatus("sending");
    const startedAt = Number.parseInt(nlStartedAtRef.current?.value ?? "", 10);
    const r = await subscribeNewsletter({
      email: nlEmail,
      website: nlWebsite,
      startedAt: Number.isFinite(startedAt) ? startedAt : undefined,
    });
    if (r.ok) { setNlStatus("done"); setNlMsg("Bedankt! Check je mail om je aanmelding te bevestigen."); setNlEmail(""); }
    else { setNlStatus("error"); setNlMsg(r.error ?? "Er ging iets mis."); }
  }

  return (
    <footer className="bg-ink text-white/85">
      {/* Pre-footer: USP balk */}
      <div className="border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <ul className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/10 list-none m-0 p-0">
            {shippingInfo.footerUsps.map((item) => (
              <li key={item.title} className="py-8 lg:py-10 lg:px-8 first:lg:pl-0 last:lg:pr-0">
                <p className="text-white text-base font-medium mb-1">{item.title}</p>
                <p className="text-sm text-white/75">{item.sub}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Hoofdinhoud */}
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-20 lg:pt-24 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16 lg:mb-20 pb-12 border-b border-white/10">
          {/* Logo + statement */}
          <div className="lg:col-span-5">
            <Image
              src="/images/logo.png"
              alt={name}
              width={220}
              height={80}
              className="h-14 w-auto mb-7 brightness-0 invert opacity-80"
            />
            <p className="font-serif text-2xl lg:text-3xl text-white/90 leading-snug max-w-md mb-6">
              {tagline.split("ziel").length > 1 ? (
                <>
                  {tagline.split("ziel")[0]}
                  <span className="italic">ziel</span>
                  {tagline.split("ziel")[1]}
                </>
              ) : tagline}
            </p>
            <p className="flex items-center gap-3 text-sm text-white/75">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-light" aria-hidden="true" />
              <span className="uppercase tracking-[0.2em]">Sinds {foundingYear}, {foundingCity}</span>
            </p>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-5 lg:col-start-8 flex flex-col justify-end">
            <h2 className={footerHeading}>Nieuwsbrief</h2>
            <p className="text-base text-white/80 mb-5">
              Nieuwe collecties en inspiratie. Maximaal 2x per maand.
            </p>
            {nlStatus === "done" ? (
              <p className="text-white text-base py-3" role="status">{nlMsg}</p>
            ) : (
              <form onSubmit={handleNewsletter} className="flex items-end border-b border-white/40 focus-within:border-white transition-colors">
                {/* Honeypot: onzichtbaar voor mensen, bots vullen het in. */}
                <div className="hp-field" aria-hidden="true">
                  <label htmlFor="footer-newsletter-website">Website</label>
                  <input
                    id="footer-newsletter-website"
                    type="text"
                    name="website"
                    value={nlWebsite}
                    onChange={(e) => setNlWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>
                <input ref={nlStartedAtRef} type="hidden" name="startedAt" defaultValue="" />
                <label htmlFor="footer-newsletter-email" className="sr-only">E-mailadres voor de nieuwsbrief</label>
                <input
                  id="footer-newsletter-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={nlEmail}
                  onChange={(e) => setNlEmail(e.target.value)}
                  placeholder="jouw@email.nl"
                  className="flex-1 min-w-0 bg-transparent py-3 min-h-11 text-white placeholder-white/70 text-base focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={nlStatus === "sending"}
                  className="min-h-11 text-white hover:text-accent-light text-sm font-medium uppercase tracking-[0.14em] px-3 transition-colors disabled:opacity-60"
                >
                  {nlStatus === "sending" ? "Bezig…" : "Aanmelden"}
                </button>
              </form>
            )}
            {nlStatus === "error" && <p className="text-error-light text-sm mt-2" role="alert">{nlMsg}</p>}
          </div>
        </div>

        {/* Shop — alle categorieën per groep (bron: lib/categories.ts) */}
        <nav aria-label="Categorieën" className="mb-16">
          <h2 className={footerHeading}>Shop</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-y-10 gap-x-6">
            {shopGroups.map((g) => (
              <div key={g.group}>
                <p className="text-base font-medium text-white mb-3">
                  {g.umbrellaHref ? (
                    <Link href={g.umbrellaHref} className="hover:underline underline-offset-4">
                      {g.group}
                    </Link>
                  ) : (
                    g.group
                  )}
                </p>
                <ul className="space-y-2.5 text-base list-none m-0 p-0">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className={footerLink}>{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 text-base">
            <Link href="/products" className={footerLink}>Bekijk alle producten</Link>
          </p>
        </nav>

        {/* Service / Over ons / Bezoek */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-12 gap-y-10 gap-x-6 mb-16">
          <div className="lg:col-span-3">
            <h2 className={footerHeading}>Service</h2>
            <ul className="space-y-2.5 text-base list-none m-0 p-0">
              <li><Link href={legal.returnPolicyUrl} className={footerLink}>Retourneren &amp; ruilen</Link></li>
              <li><Link href="/bezorging" className={footerLink}>Bezorging &amp; montage</Link></li>
              <li><Link href="/contact" className={footerLink}>Vragen? Neem contact op</Link></li>
              <li><Link href={legal.termsUrl} className={footerLink}>Algemene voorwaarden</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h2 className={footerHeading}>Over ons</h2>
            <ul className="space-y-2.5 text-base list-none m-0 p-0">
              <li><Link href="/about" className={footerLink}>Over Mokka Home</Link></li>
              <li><Link href="/contact" className={footerLink}>Contact &amp; showroom</Link></li>
              <li><Link href={legal.privacyPolicyUrl} className={footerLink}>Privacybeleid</Link></li>
              <li><Link href={legal.cookiePolicyUrl} className={footerLink}>Cookiebeleid</Link></li>
            </ul>
          </div>

          <div className="sm:col-span-3 lg:col-span-6 lg:col-start-7">
            <h2 className={footerHeading}>Showroom</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6 text-base">
              <address className="not-italic space-y-2.5">
                <a
                  href={getMapsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block ${footerLink}`}
                >
                  <span className="block text-white">{address.street}</span>
                  <span className="block">{address.postalCode} {address.city}</span>
                </a>
                {hoursLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {!businessInfo.openingHours.sunday && <p>Zondag gesloten</p>}
              </address>
              {(emailLink || phoneLink) && (
                <div className="space-y-3">
                  {phoneLink && businessInfo.contact.phoneFormatted && (
                    <p>
                      <span className="block text-sm text-white/70 mb-1">Telefoon</span>
                      <a
                        href={phoneLink}
                        className={`inline-flex items-center gap-2 min-h-11 ${footerLink}`}
                        aria-label={`Bel ons: ${businessInfo.contact.phoneFormatted}`}
                      >
                        <Phone className="w-4 h-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                        <span>{businessInfo.contact.phoneFormatted}</span>
                      </a>
                    </p>
                  )}
                  {emailLink && (
                    <p>
                      <span className="block text-sm text-white/70 mb-1">E-mail</span>
                      <a href={emailLink} className={`inline-flex items-center min-h-11 break-all ${footerLink}`}>
                        {businessInfo.contact.email}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment methods + social */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-white/10">
          {/* Payment logos */}
          <div>
            <h2 className={footerHeading}>Veilig betalen met</h2>
            {mollieMethods.length > 0 ? (
              // Live uit Mollie — dezelfde methoden als op de checkout, kleuriconen
              // op witte chips zodat ze leesbaar zijn op de donkere footer.
              <ul className="flex flex-wrap items-center gap-2 list-none m-0 p-0">
                {mollieMethods.map((m) => (
                  <li key={m.id}>
                    {m.image ? (
                      <span className="bg-white rounded-md h-8 px-2 inline-flex items-center" title={m.description}>
                        <Image src={m.image} alt={m.description} width={40} height={24} unoptimized className="h-5 w-auto" />
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-white/85">{m.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              // Fallback (bv. zonder Mollie-key): vaste witte wordmarks.
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {paymentMethods.map((method) => (
                  <PaymentIcon key={method.name} name={method.name} />
                ))}
              </div>
            )}
          </div>

          {/* Social — alleen renderen als er actieve URLs zijn */}
          {socials.length > 0 && (
            <div className="flex items-center gap-3">
              <p className="text-[13px] uppercase tracking-[0.2em] text-white/70 mr-2">Volg ons</p>
              {socials.map(({ platform, url }) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 border border-white/40 flex items-center justify-center text-white/85 hover:text-white hover:border-white transition-all capitalize text-[13px] uppercase tracking-wider"
                  aria-label={platform}
                >
                  {platform.slice(0, 2)}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Onderlijn */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm text-white/75">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
            <p>&copy; {new Date().getFullYear()} {legalName}</p>
            {kvk && (
              <>
                <span className="hidden sm:inline text-white/70" aria-hidden="true">·</span>
                <p>KvK {kvk}</p>
              </>
            )}
            {btw && (
              <>
                <span className="hidden sm:inline text-white/70" aria-hidden="true">·</span>
                <p>BTW {btw}</p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href={legal.privacyPolicyUrl} className={footerLink}>Privacybeleid</Link>
            <Link href={legal.termsUrl} className={footerLink}>Voorwaarden</Link>
            <Link href={legal.cookiePolicyUrl} className={footerLink}>Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
