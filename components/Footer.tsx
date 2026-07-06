"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  businessInfo,
  getEmailLink,
  getPhoneLink,
  getMapsUrl,
  getOpeningHoursCompact,
  getActiveSocials,
} from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { PaymentIcon } from "@/components/PaymentIcons";

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  const phoneLink = getPhoneLink();
  const emailLink = getEmailLink();
  const socials = getActiveSocials();
  const hoursLines = getOpeningHoursCompact();
  const { address, foundingYear, foundingCity, kvk, btw, legalName, name, tagline, paymentMethods, legal } = businessInfo;

  return (
    <footer className="bg-ink text-white/75">
      {/* Pre-footer: USP balk */}
      <div className="border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            {shippingInfo.footerUsps.map((item) => (
              <div key={item.title} className="py-8 lg:py-10 lg:px-8 first:lg:pl-0 last:lg:pr-0">
                <p className="text-white text-sm font-medium mb-1">{item.title}</p>
                <p className="text-xs text-white/70">{item.sub}</p>
              </div>
            ))}
          </div>
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
            <div className="flex items-center gap-3 text-xs text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="uppercase tracking-[0.25em]">Sinds {foundingYear}, {foundingCity}</span>
            </div>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-5 lg:col-start-8 flex flex-col justify-end">
            <p className="text-xs uppercase tracking-[0.3em] text-white/65 mb-4">Nieuwsbrief</p>
            <p className="text-sm text-white/70 mb-5">
              Nieuwe collecties en inspiratie. Maximaal 2x per maand.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="flex border-b border-white/20 focus-within:border-white/60 transition-colors">
              <input
                type="email"
                aria-label="E-mailadres voor de nieuwsbrief"
                placeholder="jouw@email.nl"
                className="flex-1 bg-transparent py-3 text-white placeholder-white/60 text-base focus:outline-none"
              />
              <button type="submit" className="text-white/80 hover:text-white text-xs uppercase tracking-[0.25em] px-2 transition-colors">
                Aanmelden
              </button>
            </form>
          </div>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-y-10 gap-x-6 mb-16">
          <div className="col-span-2 sm:col-span-2 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/65 mb-5">Shop</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/products" className="hover:text-white transition-colors">Alle producten</Link></li>
              <li><Link href="/banken" className="hover:text-white transition-colors">Banken</Link></li>
              <li><Link href="/bedden" className="hover:text-white transition-colors">Bedden</Link></li>
              <li><Link href="/tafels" className="hover:text-white transition-colors">Tafels</Link></li>
              <li><Link href="/stoelen" className="hover:text-white transition-colors">Stoelen</Link></li>
              <li><Link href="/slaapkamers" className="hover:text-white transition-colors">Slaapkamers</Link></li>
              <li><Link href="/kasten" className="hover:text-white transition-colors">Kasten</Link></li>
            </ul>
          </div>

          <div className="col-span-1 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/65 mb-5">Service</p>
            <ul className="space-y-2.5 text-sm">
              <li><span className="hover:text-white cursor-pointer transition-colors">Bezorging</span></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Montage</span></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Garantie</span></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Veelgestelde vragen</span></li>
            </ul>
          </div>

          <div className="col-span-1 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/65 mb-5">Atelier</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">Ons verhaal</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Journal</span></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Partners</span></li>
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-2 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/65 mb-5">Bezoek</p>
            <address className="not-italic space-y-2.5 text-sm mb-5">
              <a
                href={getMapsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-white transition-colors"
              >
                <p className="text-white">{address.street}</p>
                <p>{address.postalCode} {address.city}</p>
              </a>
              {hoursLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </address>
            {(emailLink || phoneLink) && (
              <div className="pt-4 border-t border-white/10 space-y-2 text-sm">
                {emailLink && <p>{businessInfo.contact.email}</p>}
                {phoneLink && businessInfo.contact.phoneFormatted && (
                  <a href={phoneLink} className="hover:text-white transition-colors">
                    {businessInfo.contact.phoneFormatted}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Payment methods + social */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-white/10">
          {/* Payment logos */}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/65 mb-4">Veilig betalen met</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {paymentMethods.map((method) => (
                <PaymentIcon key={method.name} name={method.name} />
              ))}
            </div>
          </div>

          {/* Social — alleen renderen als er actieve URLs zijn */}
          {socials.length > 0 && (
            <div className="flex items-center gap-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/65 mr-2">Volg ons</p>
              {socials.map(({ platform, url }) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:border-white/50 transition-all capitalize text-[10px] uppercase tracking-wider"
                  aria-label={platform}
                >
                  {platform.slice(0, 2)}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Onderlijn */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-white/70">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
            <p>&copy; {new Date().getFullYear()} {legalName}</p>
            {kvk && (
              <>
                <span className="hidden sm:inline text-white/40">·</span>
                <p>KvK {kvk}</p>
              </>
            )}
            {btw && (
              <>
                <span className="hidden sm:inline text-white/40">·</span>
                <p>BTW {btw}</p>
              </>
            )}
          </div>
          <div className="flex gap-5">
            <Link href={legal.privacyPolicyUrl} className="hover:text-white transition-colors">Privacybeleid</Link>
            <Link href={legal.termsUrl} className="hover:text-white transition-colors">Voorwaarden</Link>
            <Link href={legal.cookiePolicyUrl} className="hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
