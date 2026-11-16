import type { ComponentProps, ReactNode } from "react";
import NextLink from "next/link";
import Image from "next/image";
import { ChevronDown, Phone } from "lucide-react";
import {
  businessInfo,
  getEmailLink,
  getPhoneLink,
  getMapsUrl,
  getOpeningHoursCompact,
  getActiveSocials,
} from "@/lib/business-info";
import { CATEGORIES, GROUP_ORDER, categoryUrl } from "@/lib/categories";
import { MolliePaymentChips, PaymentIconRow } from "@/components/PaymentIcons";
import { FooterNewsletterForm } from "@/components/FooterNewsletterForm";
import { FooterGate } from "@/components/FooterGate";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";
import type { CheckoutMethod } from "@/lib/mollie";

// Server component: alles staat in de server-HTML, geen hydratie behalve de
// nieuwsbriefform (FooterNewsletterForm) en de /admin-check (FooterGate).
// Het <footer>-element moet blijven: components/product/useFooterInView.ts
// zoekt 'm met document.querySelector("footer").

// Footerlinks prefetchen niet: zodra de footer in beeld scrolt gaf dat ~25
// _rsc-prefetches voor pagina's die zelden de volgende stap zijn. Next prefetcht
// dan alsnog niets bij hover; de navigatie zelf blijft gewoon client-side.
function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}

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

// Footerkoppen zijn labels, geen display-koppen: sans (de globale h-regel zou
// ze serif maken), 14px hoofdletters zoals de eyebrow-utility.
const footerHeading = "font-sans text-sm font-medium uppercase tracking-label text-white/70 mb-5";
// Elke tekstlink is een touch target van ≥ 44px hoog (WCAG 2.5.8 / CLAUDE.md §7).
const footerLink =
  "inline-flex min-h-11 items-center text-white/85 hover:text-white underline-offset-4 hover:underline transition-colors";

/**
 * Linkgroep: op mobiel (< sm) een dichtgeklapte <details>-accordeon zodat de
 * footer kort blijft; vanaf sm de gewone kop met lijst. Twee varianten in de
 * DOM, de verborgen (display:none) telt niet mee voor toetsenbord of AT.
 */
function FooterGroup({ title, className = "", children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <>
      <details className="group sm:hidden border-b border-white/10">
        <summary className="flex items-center justify-between gap-4 min-h-14 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <h2 className="font-sans text-sm font-medium uppercase tracking-label text-white">{title}</h2>
          <ChevronDown className="w-5 h-5 shrink-0 text-white/70 transition-transform duration-300 group-open:rotate-180" strokeWidth={1.5} aria-hidden="true" />
        </summary>
        <div className="pb-6">{children}</div>
      </details>
      <div className={`hidden sm:block ${className}`}>
        <h2 className={footerHeading}>{title}</h2>
        {children}
      </div>
    </>
  );
}

export default function Footer({
  mollieMethods = [],
  emptyCategoryHrefs = [],
}: {
  mollieMethods?: CheckoutMethod[];
  /** Categorieën zonder zichtbare producten: niet linken (zie app/layout). */
  emptyCategoryHrefs?: ReadonlyArray<string>;
}) {
  const empty = new Set(emptyCategoryHrefs);
  const phoneLink = getPhoneLink();
  const emailLink = getEmailLink();
  const socials = getActiveSocials();
  const hoursLines = getOpeningHoursCompact();
  const { address, foundingYear, foundingCity, kvk, btw, legalName, name, tagline, legal } = businessInfo;

  return (
    <FooterGate>
      <footer className="bg-ink text-white/85 pb-[env(safe-area-inset-bottom)]">
        {/* Geen USP-strip meer: die staan al in de TopBanner (en TrustBar op home). */}
        {/* Hoofdinhoud */}
        <div className="max-w-page mx-auto px-6 sm:px-10 lg:px-14 pt-12 sm:pt-20 lg:pt-24 pb-8 sm:pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-12 mb-8 sm:mb-16 lg:mb-20 pb-10 sm:pb-12 border-b border-white/10">
            {/* Logo + statement */}
            <div className="lg:col-span-5">
              <Image
                src="/images/logo.png"
                alt={name}
                width={160}
                height={55}
                className="h-12 sm:h-14 w-auto mb-6 sm:mb-7 brightness-0 invert opacity-80"
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
                <span className="uppercase tracking-label">Sinds {foundingYear}, {foundingCity}</span>
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
          <nav aria-label="Categorieën" className="sm:mb-16">
            <FooterGroup title="Shop">
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
                    {g.links.filter((l) => !empty.has(l.href)).map((l) => (
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
            </FooterGroup>
          </nav>

          {/* Service / Over ons / Bezoek */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-12 sm:gap-y-10 gap-x-6 mb-6 sm:mb-16">
            <FooterGroup title="Service" className="lg:col-span-3">
              <ul className="text-base list-none m-0 p-0">
                <li><Link href={legal.returnPolicyUrl} className={footerLink}>Retourneren</Link></li>
                <li><Link href="/bezorging" className={footerLink}>Bezorging &amp; montage</Link></li>
                <li><Link href="/betalen" className={footerLink}>Veilig betalen</Link></li>
                <li><Link href="/gids" className={footerLink}>Woongids: maten &amp; keuzes</Link></li>
                <li><Link href="/contact" className={footerLink}>Vragen? Neem contact op</Link></li>
                <li><Link href={legal.termsUrl} className={footerLink}>Algemene voorwaarden</Link></li>
              </ul>
            </FooterGroup>

            <FooterGroup title="Over ons" className="lg:col-span-3">
              <ul className="text-base list-none m-0 p-0">
                <li><Link href="/about" className={footerLink}>Over Mokka Home</Link></li>
                <li><Link href="/showroom" className={footerLink}>Showroom in {address.city}</Link></li>
                <li><Link href="/contact" className={footerLink}>Contact &amp; showroom</Link></li>
                <li><Link href={legal.privacyPolicyUrl} className={footerLink}>Privacybeleid</Link></li>
                <li><Link href={legal.cookiePolicyUrl} className={footerLink}>Cookiebeleid</Link></li>
                <li><CookieSettingsButton className={`${footerLink} cursor-pointer`} /></li>
              </ul>
            </FooterGroup>

            <FooterGroup title="Showroom" className="sm:col-span-3 lg:col-span-6 lg:col-start-7">
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
            </FooterGroup>
          </div>

          {/* Mobiel: het telefoonnummer blijft zichtbaar, ook met de accordeons dicht. */}
          {phoneLink && businessInfo.contact.phoneFormatted && (
            <p className="sm:hidden mb-8 text-base">
              <a
                href={phoneLink}
                className={`gap-2 ${footerLink}`}
                aria-label={`Bel ons: ${businessInfo.contact.phoneFormatted}`}
              >
                <Phone className="w-4 h-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span>Bel ons: {businessInfo.contact.phoneFormatted}</span>
              </a>
            </p>
          )}

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
                // Fallback (bv. zonder Mollie-key): dezelfde chips, vaste lijst.
                <PaymentIconRow tone="light" />
              )}
            </div>

            {/* Social — alleen renderen als er actieve URLs zijn */}
            {socials.length > 0 && (
              <div className="flex items-center gap-3">
                <p className="font-sans text-sm uppercase tracking-label text-white/70 mr-2">Volg ons</p>
                {socials.map(({ platform, url }) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 border border-white/40 flex items-center justify-center text-white/85 hover:text-white hover:border-white transition-all capitalize text-sm uppercase tracking-label"
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
