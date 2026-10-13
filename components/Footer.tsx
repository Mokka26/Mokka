import Link from "next/link";
import Image from "next/image";
import { Phone } from "lucide-react";
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
import { MolliePaymentChips, PaymentIcon } from "@/components/PaymentIcons";
import { FooterNewsletterForm } from "@/components/FooterNewsletterForm";
import { FooterGate } from "@/components/FooterGate";
import type { CheckoutMethod } from "@/lib/mollie";

// Server component: alles staat in de server-HTML, geen hydratie behalve de
// nieuwsbriefform (FooterNewsletterForm) en de /admin-check (FooterGate).
// Het <footer>-element moet blijven: components/product/useFooterInView.ts
// zoekt 'm met document.querySelector("footer").

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
// Elke tekstlink is een touch target van ≥ 44px hoog (WCAG 2.5.8 / CLAUDE.md §7).
const footerLink =
  "inline-flex min-h-11 items-center text-white/85 hover:text-white underline-offset-4 hover:underline transition-colors";

export default function Footer({ mollieMethods = [] }: { mollieMethods?: CheckoutMethod[] }) {
  const phoneLink = getPhoneLink();
  const emailLink = getEmailLink();
  const socials = getActiveSocials();
  const hoursLines = getOpeningHoursCompact();
  const { address, foundingYear, foundingCity, kvk, btw, legalName, name, tagline, paymentMethods, legal } = businessInfo;

  return (
    <FooterGate>
      <footer className="bg-ink text-white/85 pb-[env(safe-area-inset-bottom)]">
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
                width={160}
                height={55}
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
              <FooterNewsletterForm />
            </div>
          </div>

          {/* Shop — alle categorieën per groep (bron: lib/categories.ts) */}
          <nav aria-label="Categorieën" className="mb-16">
            <h2 className={footerHeading}>Shop</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-y-10 gap-x-6">
              {shopGroups.map((g) => (
                <div key={g.group}>
                  <p className="text-base font-medium text-white mb-1">
                    {g.umbrellaHref ? (
                      <Link href={g.umbrellaHref} className="inline-flex min-h-11 items-center hover:underline underline-offset-4">
                        {g.group}
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-11 items-center">{g.group}</span>
                    )}
                  </p>
                  <ul className="text-base list-none m-0 p-0">
                    {g.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className={footerLink}>{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-8 text-base list-none m-0 p-0">
              <li><Link href="/nieuw" className={footerLink}>Nieuw binnen</Link></li>
              <li><Link href="/products" className={footerLink}>Bekijk alle producten</Link></li>
            </ul>
          </nav>

          {/* Service / Over ons / Bezoek */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-12 gap-y-10 gap-x-6 mb-16">
            <div className="lg:col-span-3">
              <h2 className={footerHeading}>Service</h2>
              <ul className="text-base list-none m-0 p-0">
                <li><Link href={legal.returnPolicyUrl} className={footerLink}>Retourneren</Link></li>
                <li><Link href="/bezorging" className={footerLink}>Bezorging &amp; montage</Link></li>
                <li><Link href="/betalen" className={footerLink}>Veilig betalen</Link></li>
                <li><Link href="/gids" className={footerLink}>Woongids: maten &amp; keuzes</Link></li>
                <li><Link href="/contact" className={footerLink}>Vragen? Neem contact op</Link></li>
                <li><Link href={legal.termsUrl} className={footerLink}>Algemene voorwaarden</Link></li>
              </ul>
            </div>

            <div className="lg:col-span-3">
              <h2 className={footerHeading}>Over ons</h2>
              <ul className="text-base list-none m-0 p-0">
                <li><Link href="/about" className={footerLink}>Over Mokka Home</Link></li>
                <li><Link href="/showroom" className={footerLink}>Showroom in {address.city}</Link></li>
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
                    className="block py-1 text-white/85 hover:text-white underline-offset-4 hover:underline transition-colors"
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
                          className={`gap-2 ${footerLink}`}
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
                        <a href={emailLink} className={`break-all ${footerLink}`}>
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
                // Live uit Mollie — dezelfde methoden als op de checkout; dezelfde
                // chips staan in het koopblok op de productpagina.
                <MolliePaymentChips methods={mollieMethods} />
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

          {/* Onderlijn — juridische links ≥ 14px met 44px-hoge klikvlakken */}
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
            <ul className="flex flex-wrap gap-x-2 -mx-3 list-none m-0 p-0 text-sm">
              <li><Link href={legal.privacyPolicyUrl} className={`px-3 ${footerLink}`}>Privacybeleid</Link></li>
              <li><Link href={legal.termsUrl} className={`px-3 ${footerLink}`}>Voorwaarden</Link></li>
              <li><Link href={legal.cookiePolicyUrl} className={`px-3 ${footerLink}`}>Cookies</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </FooterGate>
  );
}
