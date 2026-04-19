"use client";

import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-ink text-white/60">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14 pt-24 lg:pt-32 pb-8">
        {/* Top sectie — logo + statement */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20 lg:mb-28 pb-16 border-b border-white/10">
          <div className="lg:col-span-5">
            <Image
              src="/images/logo.png"
              alt="Mokka Home Interior"
              width={240}
              height={90}
              className="h-16 w-auto mb-8 brightness-0 invert opacity-70"
            />
            <p className="font-serif text-2xl lg:text-3xl text-white/90 leading-snug max-w-md">
              Meubels met een <span className="italic">ziel</span>, geselecteerd voor het moderne thuis.
            </p>
          </div>
          <div className="lg:col-span-5 lg:col-start-8 flex flex-col justify-end">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-4">Newsletter</p>
            <form onSubmit={(e) => e.preventDefault()} className="flex border-b border-white/20 focus-within:border-white/60 transition-colors">
              <input
                type="email"
                placeholder="jouw@email.nl"
                className="flex-1 bg-transparent py-3 text-white placeholder-white/30 text-sm focus:outline-none"
              />
              <button type="submit" className="text-white/60 hover:text-white text-xs uppercase tracking-[0.25em] px-2">
                Aanmelden
              </button>
            </form>
          </div>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-y-12 gap-x-8 mb-20">
          <div className="col-span-2 sm:col-span-3 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-5">Collectie</p>
            <ul className="space-y-3 text-sm">
              <li><Link href="/products" className="hover:text-white transition-colors">Alle Producten</Link></li>
              <li><Link href="/products?category=banken" className="hover:text-white transition-colors">Banken</Link></li>
              <li><Link href="/products?category=slaapkamers" className="hover:text-white transition-colors">Slaapkamers</Link></li>
              <li><Link href="/products?category=kasten" className="hover:text-white transition-colors">Kasten</Link></li>
              <li><Link href="/products?category=tafels" className="hover:text-white transition-colors">Tafels</Link></li>
              <li><Link href="/products?category=stoelen" className="hover:text-white transition-colors">Stoelen</Link></li>
            </ul>
          </div>

          <div className="col-span-1 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-5">Atelier</p>
            <ul className="space-y-3 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">Ons verhaal</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Journal</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Pers</span></li>
            </ul>
          </div>

          <div className="col-span-1 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-5">Service</p>
            <ul className="space-y-3 text-sm">
              <li><span className="hover:text-white transition-colors cursor-pointer">Verzending</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Retour & Ruil</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Veelgestelde vragen</span></li>
              <li><span className="hover:text-white transition-colors cursor-pointer">Garantie</span></li>
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-3 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-5">Contact</p>
            <address className="not-italic space-y-3 text-sm">
              <p>hallo@mokkahome.nl</p>
              <p>+31 (0)20 123 4567</p>
              <p>Herengracht 100<br />1015 BS Amsterdam</p>
            </address>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-white/30">
          <p>&copy; {new Date().getFullYear()} Mokka Home Interior</p>
          <div className="flex gap-6">
            <span className="hover:text-white/70 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-white/70 cursor-pointer transition-colors">Voorwaarden</span>
            <span className="hover:text-white/70 cursor-pointer transition-colors">Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
