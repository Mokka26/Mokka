"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, Menu, X, ChevronDown } from "lucide-react";
import TopBanner from "./TopBanner";
import CartDrawer from "./CartDrawer";
import { businessInfo, getPhoneLink } from "@/lib/business-info";

interface SubLink { label: string; href: string }
interface NavItem {
  label: string;
  href: string;
  subLinks?: { heading: string; links: SubLink[] }[];
  featured?: { image: string; label: string; href: string };
}

const navItems: NavItem[] = [
  {
    label: "Woonkamer",
    href: "/banken",
    subLinks: [
      {
        heading: "Zitmeubelen",
        links: [
          { label: "Alle banken", href: "/banken" },
          { label: "Hoekbanken", href: "/hoekbanken" },
          { label: "Bankstellen", href: "/bankstellen" },
        ],
      },
      {
        heading: "Tafels",
        links: [
          { label: "Alle tafels", href: "/tafels" },
        ],
      },
      {
        heading: "Kasten & Opbergen",
        links: [
          { label: "Alle kasten", href: "/kasten" },
          { label: "Dressoirs", href: "/dressoirs" },
          { label: "TV-meubels", href: "/tv-meubels" },
          { label: "Kapstokken", href: "/kapstokken" },
        ],
      },
      {
        heading: "Accessoires",
        links: [
          { label: "Verlichting", href: "/verlichting" },
          { label: "Spiegels", href: "/spiegels" },
        ],
      },
    ],
    featured: {
      image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=90",
      label: "Voorjaar 2026",
      href: "/banken",
    },
  },
  {
    label: "Tafels",
    href: "/tafels",
    subLinks: [
      {
        heading: "Soorten tafels",
        links: [
          { label: "Alle tafels", href: "/tafels" },
          { label: "Eettafels", href: "/eettafels" },
          { label: "Salontafels", href: "/salontafels" },
          { label: "Bijzettafels", href: "/bijzettafels" },
          { label: "Tafel-accessoires", href: "/tafel-accessoires" },
        ],
      },
    ],
  },
  {
    label: "Stoelen",
    href: "/stoelen",
    subLinks: [
      {
        heading: "Soorten stoelen",
        links: [
          { label: "Alle stoelen", href: "/stoelen" },
          { label: "Eetkamerstoelen", href: "/eetkamerstoelen" },
          { label: "Fauteuils", href: "/fauteuils" },
        ],
      },
    ],
  },
  {
    label: "Slaapkamer",
    href: "/bedden",
    subLinks: [
      {
        heading: "Bedden",
        links: [
          { label: "Alle bedden", href: "/bedden" },
          { label: "Matrassen", href: "/matrassen" },
          { label: "Complete slaapkamers", href: "/slaapkamers" },
        ],
      },
      {
        heading: "Opbergen",
        links: [
          { label: "Kledingkasten", href: "/kledingkasten" },
          { label: "Nachtkastjes", href: "/nachtkastjes" },
          { label: "Ladekasten & Commodes", href: "/ladekasten" },
        ],
      },
    ],
    featured: {
      image: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=600&q=90",
      label: "Nieuwe bedcollectie",
      href: "/bedden",
    },
  },
  {
    label: "Sfeer",
    href: "/verlichting",
    subLinks: [
      {
        heading: "Verlichting",
        links: [
          { label: "Alle verlichting", href: "/verlichting" },
          { label: "Plafondlampen", href: "/plafondlampen" },
          { label: "Vloerlampen", href: "/vloerlampen" },
          { label: "Tafellampen", href: "/tafellampen" },
          { label: "Wandlampen", href: "/wandlampen" },
        ],
      },
      {
        heading: "Wandaccessoires",
        links: [
          { label: "Spiegels", href: "/spiegels" },
        ],
      },
    ],
  },
  { label: "Lookbook", href: "/lookbook" },
  { label: "Aanbiedingen", href: "/products?sort=price-asc" },
  { label: "Atelier", href: "/about" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeMobileItem, setActiveMobileItem] = useState<string | null>(null);
  const { totalItems } = useCart();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (pathname?.startsWith("/admin")) return null;

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
          scrolled ? "bg-paper/98 backdrop-blur-md border-b border-line" : "bg-paper/90 backdrop-blur-sm"
        }`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        onMouseLeave={() => setActiveDropdown(null)}
      >
        {/* Top banner — verdwijnt bij scroll */}
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              initial={{ height: 36, opacity: 1 }}
              animate={{ height: 36, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <TopBanner />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-[1600px] mx-auto">
          <nav className="flex items-center justify-between h-16 lg:h-20 px-6 sm:px-10 lg:px-14">
            {/* Logo links */}
            <Link href="/" className="flex-shrink-0">
              <Image
                src="/images/logo.png"
                alt="Mokka Home Interior"
                width={180}
                height={60}
                className="h-10 sm:h-12 lg:h-14 w-auto"
                priority
              />
            </Link>

            {/* Desktop navigation — center */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => item.subLinks && setActiveDropdown(item.label)}
                >
                  <Link
                    href={item.href}
                    className={`relative flex items-center gap-1 px-4 py-2 text-xs uppercase tracking-[0.08em] font-medium transition-colors duration-[280ms] ${
                      activeDropdown === item.label ? "text-accent" : "text-ink hover:text-accent"
                    }`}
                    style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                  >
                    {/* SIGNATURE: vertical-line indicator op active nav-item */}
                    <span
                      className={`absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-[2px] bg-accent transition-opacity duration-[280ms] ${
                        activeDropdown === item.label ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    {item.label}
                    {item.subLinks && (
                      <ChevronDown className={`w-3 h-3 transition-transform duration-[280ms] ${activeDropdown === item.label ? "rotate-180" : ""}`} strokeWidth={1.5} />
                    )}
                  </Link>
                </div>
              ))}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3 lg:gap-4">
              <button onClick={() => setSearchOpen(true)} className="text-ink hover:text-accent transition-colors duration-[280ms] p-2" aria-label="Zoeken">
                <Search className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setCartDrawerOpen(true)}
                className="relative text-ink hover:text-accent transition-colors duration-[280ms] p-2"
                aria-label="Winkelwagen"
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 bg-accent text-paper text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
                    {totalItems}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden text-ink hover:text-accent transition-colors duration-[280ms] p-2"
                aria-label="Menu"
              >
                <Menu className="w-6 h-6" strokeWidth={1.5} />
              </button>
            </div>
          </nav>

          {/* Desktop mega menu dropdowns */}
          <AnimatePresence>
            {activeDropdown && (() => {
              const item = navItems.find((n) => n.label === activeDropdown);
              if (!item || !item.subLinks) return null;
              return (
                <motion.div
                  initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
                  animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
                  exit={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
                  transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute left-0 right-0 bg-paper border-t border-line shadow-[0_30px_60px_-20px_rgba(20,17,13,0.12)] hidden lg:block"
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
                    <div className="grid grid-cols-12 gap-8">
                      {/* Sublink groups */}
                      <div className={`${item.featured ? "col-span-8" : "col-span-12"} grid grid-cols-2 lg:grid-cols-4 gap-8`}>
                        {item.subLinks.map((group) => (
                          <div key={group.heading}>
                            <p className="eyebrow mb-5">{group.heading}</p>
                            <ul className="space-y-3">
                              {group.links.map((l) => (
                                <li key={l.label}>
                                  <Link
                                    href={l.href}
                                    onClick={() => setActiveDropdown(null)}
                                    className="text-sm text-slate hover:text-accent transition-colors duration-[280ms]"
                                  >
                                    {l.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {/* Featured visual */}
                      {item.featured && (
                        <div className="col-span-4">
                          <Link
                            href={item.featured.href}
                            onClick={() => setActiveDropdown(null)}
                            className="group block"
                          >
                            <div className="relative aspect-[4/3] overflow-hidden bg-bone mb-3">
                              <Image
                                src={item.featured.image}
                                alt={item.featured.label}
                                fill
                                className="object-cover transition-transform duration-[1.2s] group-hover:scale-105"
                                sizes="400px"
                              />
                            </div>
                            <p className="eyebrow mb-1">Uitgelicht</p>
                            <p className="font-serif text-xl text-ink group-hover:text-accent transition-colors duration-[280ms]">
                              {item.featured.label}
                            </p>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-paper flex flex-col lg:hidden"
          >
            <div className="flex items-center justify-between px-6 h-16 border-b border-line">
              <span className="eyebrow">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-ink" aria-label="Sluiten">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-8">
              <ul className="space-y-0">
                {navItems.map((item) => (
                  <li key={item.label} className="border-b border-line last:border-b-0">
                    {item.subLinks ? (
                      <>
                        <button
                          onClick={() => setActiveMobileItem(activeMobileItem === item.label ? null : item.label)}
                          className="w-full flex items-center justify-between py-5 text-left"
                        >
                          <span className="font-serif text-2xl text-ink">{item.label}</span>
                          <ChevronDown className={`w-5 h-5 text-stone transition-transform ${activeMobileItem === item.label ? "rotate-180" : ""}`} strokeWidth={1.5} />
                        </button>
                        <AnimatePresence>
                          {activeMobileItem === item.label && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="pb-5 pl-0 space-y-5">
                                {item.subLinks.map((group) => (
                                  <div key={group.heading}>
                                    <p className="eyebrow mb-3">{group.heading}</p>
                                    <ul className="space-y-2.5">
                                      {group.links.map((l) => (
                                        <li key={l.label}>
                                          <Link
                                            href={l.href}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="text-sm text-slate"
                                          >
                                            {l.label}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-5 font-serif text-2xl text-ink"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>

              {/* Contact info onderaan in mobile menu */}
              <div className="mt-10 pt-8 border-t border-line">
                <p className="eyebrow mb-4">Contact</p>
                <div className="space-y-2 text-sm text-slate">
                  {businessInfo.contact.email && <p>{businessInfo.contact.email}</p>}
                  {getPhoneLink() && businessInfo.contact.phoneFormatted && (
                    <a href={getPhoneLink()!} className="block hover:text-ink transition-colors">
                      {businessInfo.contact.phoneFormatted}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-paper/98 backdrop-blur-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 sm:px-10 lg:px-14 h-16 lg:h-20 border-b border-line">
              <span className="eyebrow">Zoeken</span>
              <button onClick={() => setSearchOpen(false)} className="text-ink" aria-label="Sluiten">
                <X className="w-5 h-5" strokeWidth={1.5} />
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
                    placeholder="Wat zoek je?"
                    autoFocus
                    className="w-full text-2xl sm:text-4xl lg:text-5xl font-serif py-6 pl-12 sm:pl-16 bg-transparent border-0 border-b border-line focus:outline-none focus:border-ink transition-colors placeholder-stone/50"
                  />
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <p className="eyebrow w-full mb-2">Populair</p>
                  {["Banken", "Eettafels", "Loungestoelen", "Boxsprings"].map((term) => (
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

      {/* Cart drawer */}
      <CartDrawer open={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />
    </>
  );
}
