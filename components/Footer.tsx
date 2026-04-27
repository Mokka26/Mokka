"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="bg-ink text-white/60">
      {/* Pre-footer: USP balk */}
      <div className="border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            {[
              { title: "Gratis verzending", sub: "Vanaf €100 in NL" },
              { title: "Montageservice", sub: "Op afspraak mogelijk" },
              { title: "30 dagen retour", sub: "Geen vragen gesteld" },
              { title: "Veilig betalen", sub: "iDEAL, creditcard, Klarna" },
            ].map((item) => (
              <div key={item.title} className="py-8 lg:py-10 lg:px-8 first:lg:pl-0 last:lg:pr-0">
                <p className="text-white text-sm font-medium mb-1">{item.title}</p>
                <p className="text-xs text-white/50">{item.sub}</p>
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
              alt="Mokka Home Interior"
              width={220}
              height={80}
              className="h-14 w-auto mb-7 brightness-0 invert opacity-80"
            />
            <p className="font-serif text-2xl lg:text-3xl text-white/90 leading-snug max-w-md mb-6">
              Meubels met een <span className="italic">ziel</span>, geselecteerd voor het moderne thuis.
            </p>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-bronze" />
              <span className="uppercase tracking-[0.25em]">Sinds 2024, Amsterdam</span>
            </div>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-5 lg:col-start-8 flex flex-col justify-end">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-4">Nieuwsbrief</p>
            <p className="text-sm text-white/70 mb-5">
              Nieuwe collecties en inspiratie. Maximaal 2x per maand.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="flex border-b border-white/20 focus-within:border-white/60 transition-colors">
              <input
                type="email"
                placeholder="jouw@email.nl"
                className="flex-1 bg-transparent py-3 text-white placeholder-white/30 text-sm focus:outline-none"
              />
              <button type="submit" className="text-white/60 hover:text-white text-xs uppercase tracking-[0.25em] px-2 transition-colors">
                Aanmelden
              </button>
            </form>
          </div>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-y-10 gap-x-6 mb-16">
          <div className="col-span-2 sm:col-span-2 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-5">Shop</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/products" className="hover:text-white transition-colors">Alle producten</Link></li>
              <li><Link href="/products?category=banken" className="hover:text-white transition-colors">Banken</Link></li>
              <li><Link href="/products?category=bedden" className="hover:text-white transition-colors">Bedden</Link></li>
              <li><Link href="/products?category=tafels" className="hover:text-white transition-colors">Tafels</Link></li>
              <li><Link href="/products?category=stoelen" className="hover:text-white transition-colors">Stoelen</Link></li>
              <li><Link href="/products?category=slaapkamers" className="hover:text-white transition-colors">Slaapkamers</Link></li>
              <li><Link href="/products?category=kasten" className="hover:text-white transition-colors">Kasten</Link></li>
            </ul>
          </div>

          <div className="col-span-1 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-5">Service</p>
            <ul className="space-y-2.5 text-sm">
              <li><span className="hover:text-white cursor-pointer transition-colors">Bezorging</span></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Montage</span></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Retour & ruil</span></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Garantie</span></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Veelgestelde vragen</span></li>
            </ul>
          </div>

          <div className="col-span-1 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-5">Atelier</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">Ons verhaal</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Journal</span></li>
              <li><span className="hover:text-white cursor-pointer transition-colors">Partners</span></li>
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-2 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-5">Bezoek</p>
            <address className="not-italic space-y-2.5 text-sm mb-5">
              <a
                href="https://www.google.com/maps/search/?api=1&query=Dynamostraat+5%2C+2525+KB+Den+Haag"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-white transition-colors"
              >
                <p className="text-white">Dynamostraat 5</p>
                <p>2525 KB Den Haag</p>
              </a>
              <p>Ma–Vr 10:00–18:00</p>
              <p>Za 11:00–17:00</p>
            </address>
            <div className="pt-4 border-t border-white/10 space-y-2 text-sm">
              <p>hallo@mokkahome.nl</p>
              <a href="tel:+31701234567" className="hover:text-white transition-colors">+31 (0)70 123 4567</a>
            </div>
          </div>
        </div>

        {/* Payment methods + social */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-white/10">
          {/* Payment logos */}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-4">Betaalmethoden</p>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { name: "iDEAL", bg: "#CC0066" },
                { name: "Visa", bg: "#1A1F71" },
                { name: "Mastercard", bg: "#EB001B" },
                { name: "Bancontact", bg: "#000000" },
                { name: "Apple Pay", bg: "#000000" },
                { name: "Klarna", bg: "#FFA8CD" },
                { name: "PayPal", bg: "#003087" },
              ].map((method) => (
                <div
                  key={method.name}
                  className="h-8 px-3 flex items-center justify-center text-[10px] font-semibold text-white rounded-sm"
                  style={{ backgroundColor: method.bg }}
                >
                  {method.name}
                </div>
              ))}
            </div>
          </div>

          {/* Social */}
          <div className="flex items-center gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mr-2">Volg ons</p>
            <Link href="#" className="w-10 h-10 border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/50 transition-all" aria-label="Instagram">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </Link>
            <Link href="#" className="w-10 h-10 border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/50 transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0a12 12 0 1012 12A12 12 0 0012 0zm5.4 8.38a.73.73 0 01-.74.74 6.57 6.57 0 00-5.19 0 .74.74 0 01-.31-1.45A8 8 0 0116.66 7.7a.73.73 0 01.74.68zm-1.63 2.82a.64.64 0 01-.61.67 4.84 4.84 0 00-3.68-.13.64.64 0 01-.25-1.25A6.11 6.11 0 0115.08 10.53a.64.64 0 01.69.67zm-.84 2.52a.51.51 0 01-.51.51 3.26 3.26 0 00-2.5-.18.52.52 0 01-.2-1 4.3 4.3 0 013.28.23.51.51 0 01.44.44z"/>
              </svg>
            </Link>
            <Link href="#" className="w-10 h-10 border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/50 transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.2 0H1.8A1.8 1.8 0 000 1.8v20.4A1.8 1.8 0 001.8 24h20.4a1.8 1.8 0 001.8-1.8V1.8A1.8 1.8 0 0022.2 0zM7.1 20.5H3.6V9h3.5zM5.3 7.4a2 2 0 110-4 2 2 0 010 4zm15.2 13.1H17V14.9c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7h-3.5V9h3.4v1.5a3.7 3.7 0 013.3-1.8c3.6 0 4.2 2.3 4.2 5.3z"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* Onderlijn */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-white/30">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
            <p>&copy; {new Date().getFullYear()} Mokka Home Interior BV</p>
            <span className="hidden sm:inline text-white/20">·</span>
            <p>KvK 12345678</p>
            <span className="hidden sm:inline text-white/20">·</span>
            <p>BTW NL123456789B01</p>
          </div>
          <div className="flex gap-5">
            <Link href="#" className="hover:text-white/70 transition-colors">Privacybeleid</Link>
            <Link href="#" className="hover:text-white/70 transition-colors">Voorwaarden</Link>
            <Link href="#" className="hover:text-white/70 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
