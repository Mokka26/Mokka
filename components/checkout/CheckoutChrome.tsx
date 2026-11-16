import Link from "next/link";
import Image from "next/image";
import { Lock, Phone } from "lucide-react";
import { businessInfo, getPhoneLink } from "@/lib/business-info";

// Kale omlijsting voor de checkout (server components): geen megamenu,
// USP-balk of nieuwsbrief die afleiden tijdens het afrekenen. Wel: logo terug
// naar de winkelwagen, het telefoonnummer (CLAUDE.md §3: op elke pagina),
// "Veilig betalen" en de juridische links met KvK. De gewone Navbar/Footer
// verbergen zich op /checkout (zie Navbar.tsx en FooterGate.tsx).

export function CheckoutHeader() {
  const phoneLink = getPhoneLink();
  const phoneFormatted = businessInfo.contact.phoneFormatted;
  return (
    <header className="bg-paper border-b border-line">
      <div className="max-w-page mx-auto px-4 min-[375px]:px-6 sm:px-10 lg:px-14 h-16 lg:h-20 flex items-center justify-between gap-4">
        <Link
          href="/cart"
          className="shrink-0 inline-flex items-center min-h-11"
          aria-label={`${businessInfo.name}: terug naar je winkelwagen`}
        >
          <Image src="/images/logo.png" alt="" width={160} height={55} className="h-10 sm:h-12 w-auto" loading="eager" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-6 text-base text-ink">
          <p className="hidden sm:inline-flex items-center gap-2">
            <Lock className="w-4 h-4 text-success" strokeWidth={1.5} aria-hidden="true" />
            Veilig betalen
          </p>
          {phoneLink && phoneFormatted && (
            <a
              href={phoneLink}
              className="inline-flex items-center gap-2 min-h-11 px-2 rounded-full hover:text-accent-dark transition-colors tabular-nums"
              aria-label={`Vragen? Bel ons: ${phoneFormatted}`}
            >
              <Phone className="w-5 h-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="whitespace-nowrap">{phoneFormatted}</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function CheckoutFooter() {
  const { legal, legalName, kvk } = businessInfo;
  const link = "inline-flex items-center min-h-11 text-graphite underline-offset-4 hover:text-ink hover:underline";
  return (
    <footer className="border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-page mx-auto px-6 sm:px-10 lg:px-14 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-graphite">
        <p>
          &copy; {new Date().getFullYear()} {legalName}
          {kvk && <> · KvK {kvk}</>}
        </p>
        <ul className="flex flex-wrap gap-x-6 list-none m-0 p-0">
          {/* Juridische links: geen prefetch (zelden de volgende stap). */}
          <li><Link href={legal.termsUrl} prefetch={false} className={link}>Algemene voorwaarden</Link></li>
          <li><Link href={legal.privacyPolicyUrl} prefetch={false} className={link}>Privacybeleid</Link></li>
          <li><Link href={legal.returnPolicyUrl} prefetch={false} className={link}>Retourneren</Link></li>
        </ul>
      </div>
    </footer>
  );
}
