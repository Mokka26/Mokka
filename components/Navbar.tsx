"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, Menu, X } from "lucide-react";

const navLinks = [
  { href: "/products", label: "Collectie" },
  { href: "/products?category=banken", label: "Banken" },
  { href: "/products?category=slaapkamers", label: "Slaapkamers" },
  { href: "/products?category=kasten", label: "Kasten" },
  { href: "/products?category=tafels", label: "Tafels" },
  { href: "/products?category=stoelen", label: "Stoelen" },
  { href: "/about", label: "Atelier" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const { totalItems } = useCart();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-paper/95 backdrop-blur-md" : "bg-transparent"
        }`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <div className="max-w-[1600px] mx-auto">
          <nav className="flex items-center justify-between h-20 lg:h-24 px-6 sm:px-10 lg:px-14">
            {/* Menu — links */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center gap-3 text-ink hover:text-bronze transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" strokeWidth={1.25} />
              <span className="hidden sm:inline text-[11px] uppercase tracking-[0.25em] font-medium">Menu</span>
            </button>

            {/* Logo — midden */}
            <Link href="/" className="absolute left-1/2 -translate-x-1/2">
              <Image
                src="/images/logo.png"
                alt="Mokka Home Interior"
                width={220}
                height={80}
                className="h-12 sm:h-14 lg:h-16 w-auto"
                priority
              />
            </Link>

            {/* Acties — rechts */}
            <div className="flex items-center gap-5 lg:gap-7">
              <button
                onClick={() => setSearchOpen(true)}
                className="text-ink hover:text-bronze transition-colors"
                aria-label="Zoeken"
              >
                <Search className="w-5 h-5" strokeWidth={1.25} />
              </button>

              <Link
                href="/cart"
                className="relative text-ink hover:text-bronze transition-colors flex items-center gap-2"
                aria-label="Winkelwagen"
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={1.25} />
                <span className="text-[11px] uppercase tracking-[0.25em] font-medium hidden sm:inline">
                  Tas {totalItems > 0 && `(${totalItems})`}
                </span>
              </Link>
            </div>
          </nav>
        </div>
      </motion.header>

      {/* Fullscreen menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-paper flex flex-col"
          >
            <div className="flex items-center justify-between px-6 sm:px-10 lg:px-14 h-20 lg:h-24 border-b border-line">
              <span className="text-[11px] uppercase tracking-[0.25em] font-medium text-stone">Navigatie</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-ink hover:text-bronze transition-colors"
                aria-label="Sluiten"
              >
                <X className="w-5 h-5" strokeWidth={1.25} />
              </button>
            </div>

            <div className="flex-1 flex items-center overflow-y-auto">
              <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-8">
                    <p className="eyebrow mb-8">Collectie</p>
                    <ul className="space-y-4">
                      {navLinks.map((link, i) => (
                        <motion.li
                          key={link.label}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 + 0.1 }}
                        >
                          <Link
                            href={link.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="block font-serif text-3xl sm:text-5xl lg:text-6xl text-ink hover:text-bronze transition-colors"
                          >
                            {link.label}
                          </Link>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                  <div className="lg:col-span-4 lg:border-l lg:border-line lg:pl-12">
                    <p className="eyebrow mb-8">Contact</p>
                    <div className="space-y-6 text-sm text-graphite">
                      <div>
                        <p className="text-stone text-xs mb-1">E-mail</p>
                        <p>hallo@mokkahome.nl</p>
                      </div>
                      <div>
                        <p className="text-stone text-xs mb-1">Telefoon</p>
                        <p>+31 (0)20 123 4567</p>
                      </div>
                      <div>
                        <p className="text-stone text-xs mb-1">Atelier</p>
                        <p>Herengracht 100<br />1015 BS Amsterdam</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoek overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-paper/98 backdrop-blur-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 sm:px-10 lg:px-14 h-20 lg:h-24 border-b border-line">
              <span className="text-[11px] uppercase tracking-[0.25em] font-medium text-stone">Zoeken</span>
              <button
                onClick={() => setSearchOpen(false)}
                className="text-ink hover:text-bronze transition-colors"
                aria-label="Sluiten"
              >
                <X className="w-5 h-5" strokeWidth={1.25} />
              </button>
            </div>
            <div className="flex-1 flex items-center">
              <form onSubmit={handleSearch} className="w-full max-w-4xl mx-auto px-6 sm:px-10 lg:px-14">
                <div className="relative">
                  <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-stone" strokeWidth={1.25} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Wat zoek je vandaag?"
                    autoFocus
                    className="w-full text-2xl sm:text-4xl lg:text-5xl font-serif py-6 pl-12 sm:pl-16 bg-transparent border-0 border-b border-line focus:outline-none focus:border-ink transition-colors placeholder-stone/50"
                  />
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  {["Banken", "Eettafels", "Loungestoelen", "Vloerkleden"].map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setSearchQuery(term)}
                      className="text-xs uppercase tracking-[0.2em] text-stone hover:text-ink transition-colors border-b border-line hover:border-ink pb-1"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
