"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, Menu, ChevronDown, Phone } from "lucide-react";
import TopBanner from "./TopBanner";
import CartDrawer, { CART_DRAWER_ID } from "./CartDrawer";
import { OPEN_CART_EVENT } from "@/app/products/[slug]/ProductDetailClient";
import { Dialog, Drawer } from "@/components/ui/Dialog";
import { businessInfo, getPhoneLink } from "@/lib/business-info";

interface SubLink { label: string; href: string }
interface NavItem {
  label: string;
  href: string;
  subLinks?: { heading: string; links: SubLink[] }[];
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
        heading: "Opbergen",
        links: [
          { label: "Dressoirs", href: "/dressoirs" },
          { label: "TV-meubels", href: "/tv-meubels" },
        ],
      },
    ],
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
          { label: "Poefs", href: "/poefs" },
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
          { label: "Jeugdkamers", href: "/jeugdkamers" },
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
      {
        heading: "Hal & entree",
        links: [
          { label: "Kapstokken", href: "/kapstokken" },
          { label: "Schoenenkasten", href: "/schoenenkasten" },
        ],
      },
    ],
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
  { label: "Aanbiedingen", href: "/aanbiedingen" },
  { label: "Over ons", href: "/about" },
];

const POPULAR_SEARCHES = ["Hoekbank", "Eettafel", "Fauteuil", "Boxspring"];

// Icoonknop in de header: 44×44 touch target, zichtbare hover + focus.
const iconButton =
  "relative inline-flex items-center justify-center w-11 h-11 rounded-full text-ink hover:text-accent-dark hover:bg-bone transition-colors duration-[280ms]";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeMobileItem, setActiveMobileItem] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { totalItems } = useCart();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // PDP "In winkelwagen" → open de drawer (event uit ProductDetailClient).
  useEffect(() => {
    const openCart = (e: Event) => {
      e.preventDefault();
      setCartDrawerOpen(true);
    };
    window.addEventListener(OPEN_CART_EVENT, openCart);
    return () => window.removeEventListener(OPEN_CART_EVENT, openCart);
  }, []);

  if (pathname?.startsWith("/admin")) return null;

  const phoneLink = getPhoneLink();
  const phoneFormatted = businessInfo.contact.phoneFormatted;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/products?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const cartLabel =
    totalItems === 0
      ? "Winkelwagen, leeg"
      : `Winkelwagen, ${totalItems} ${totalItems === 1 ? "artikel" : "artikelen"}`;

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-paper border-b border-line shadow-[0_1px_0_rgba(20,17,13,0.04)]" : "bg-paper border-b border-transparent"
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
          <nav aria-label="Hoofdnavigatie" className="flex items-center justify-between gap-4 h-16 lg:h-20 px-4 sm:px-10 lg:px-14">
            {/* Logo links */}
            <Link href="/" className="flex-shrink-0 inline-flex items-center min-h-11" aria-label="Mokka Home Interior — naar de homepage">
              <Image
                src="/images/logo.png"
                alt=""
                width={180}
                height={60}
                className="h-10 sm:h-12 lg:h-14 w-auto"
                priority
              />
            </Link>

            {/* Desktop navigation — vanaf xl, zodat 16px-items naast elkaar passen */}
            <ul className="hidden xl:flex items-center list-none m-0 p-0">
              {navItems.map((item) => {
                const isOpen = activeDropdown === item.label;
                const panelId = `submenu-${slug(item.label)}`;
                return (
                  <li
                    key={item.label}
                    className="relative group"
                    onMouseEnter={() => item.subLinks && setActiveDropdown(item.label)}
                    onMouseLeave={() => item.subLinks && setActiveDropdown(null)}
                    // Toetsenbord: open het submenu wanneer het item (of een link
                    // erin) focus krijgt, en sluit zodra de focus de groep verlaat.
                    onFocus={() => item.subLinks && setActiveDropdown(item.label)}
                    onBlur={(e) => {
                      if (item.subLinks && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        setActiveDropdown(null);
                      }
                    }}
                  >
                    <Link
                      href={item.href}
                      aria-haspopup={item.subLinks ? "true" : undefined}
                      aria-expanded={item.subLinks ? isOpen : undefined}
                      aria-controls={item.subLinks ? panelId : undefined}
                      className={`relative flex items-center gap-1.5 px-3 min-h-11 text-base font-medium transition-colors duration-300 ${
                        isOpen ? "text-accent-dark" : "text-ink group-hover:text-accent-dark"
                      }`}
                    >
                      {item.label}
                      {item.subLinks && (
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      )}
                      {/* Fijne onderlijn — verschijnt bij hover/actief */}
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute bottom-1 left-3 right-3 h-px bg-accent-dark origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isOpen ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                        }`}
                      />
                    </Link>

                    {/* Compact dropdown — verankerd onder het item */}
                    {item.subLinks && (
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            id={panelId}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute left-0 top-full pt-2 z-50"
                          >
                            <div className="flex gap-10 bg-paper border border-line rounded-[12px] shadow-[0_20px_50px_-18px_rgba(20,17,13,0.22)] px-8 py-7">
                              {item.subLinks.map((group) => (
                                <div key={group.heading} className="min-w-[160px]">
                                  <p className="eyebrow mb-3 whitespace-nowrap">{group.heading}</p>
                                  <ul className="space-y-1 list-none m-0 p-0">
                                    {group.links.map((l) => (
                                      <li key={l.label}>
                                        <Link
                                          href={l.href}
                                          onClick={() => setActiveDropdown(null)}
                                          className="inline-flex items-center min-h-10 text-base text-slate hover:text-accent-dark transition-colors duration-200 whitespace-nowrap"
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
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Acties rechts: bellen, zoeken, winkelwagen, menu */}
            <div className="flex items-center gap-1 sm:gap-2">
              {phoneLink && phoneFormatted && (
                <a
                  href={phoneLink}
                  className={`${iconButton} 2xl:w-auto 2xl:px-4 2xl:gap-2 2xl:rounded-full`}
                  aria-label={`Bel ons: ${phoneFormatted}`}
                >
                  <Phone className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
                  <span className="hidden 2xl:inline text-base font-medium whitespace-nowrap">{phoneFormatted}</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className={iconButton}
                aria-label="Zoeken"
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                aria-controls="site-search"
              >
                <Search className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(true)}
                className={iconButton}
                aria-label={cartLabel}
                aria-haspopup="dialog"
                aria-expanded={cartDrawerOpen}
                aria-controls={CART_DRAWER_ID}
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
                {totalItems > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-0.5 min-w-5 h-5 px-1 rounded-full bg-ink text-paper text-xs leading-5 text-center font-medium tabular-nums"
                  >
                    {totalItems}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className={`xl:hidden ${iconButton}`}
                aria-label="Menu openen"
                aria-haspopup="dialog"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <Menu className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </nav>
        </div>
      </motion.header>

      {/* Mobiel menu — native dialog: focus blijft erin, Esc sluit, focus terug naar de knop */}
      <Drawer
        id="mobile-menu"
        side="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="Menu"
      >
        <nav aria-label="Mobiele navigatie" className="px-6 py-6">
          <ul className="list-none m-0 p-0">
            {navItems.map((item) => {
              const expanded = activeMobileItem === item.label;
              const panelId = `mobile-submenu-${slug(item.label)}`;
              return (
                <li key={item.label} className="border-b border-line last:border-b-0">
                  {item.subLinks ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveMobileItem(expanded ? null : item.label)}
                        className="w-full flex items-center justify-between gap-4 py-4 min-h-14 text-left"
                        aria-expanded={expanded}
                        aria-controls={panelId}
                      >
                        <span className="font-serif text-2xl text-ink">{item.label}</span>
                        <ChevronDown
                          className={`w-5 h-5 text-stone transition-transform ${expanded ? "rotate-180" : ""}`}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            id={panelId}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="pb-5 space-y-5">
                              {item.subLinks.map((group) => (
                                <div key={group.heading}>
                                  <p className="eyebrow mb-2">{group.heading}</p>
                                  <ul className="list-none m-0 p-0">
                                    {group.links.map((l) => (
                                      <li key={l.label}>
                                        <Link
                                          href={l.href}
                                          onClick={() => setMobileMenuOpen(false)}
                                          className="inline-flex items-center min-h-11 text-base text-slate hover:text-accent-dark"
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
                      className="flex items-center py-4 min-h-14 font-serif text-2xl text-ink hover:text-accent-dark"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Contact onderaan in het menu */}
          <div className="mt-8 pt-6 border-t border-line">
            <p className="eyebrow mb-3">Contact</p>
            <ul className="space-y-1 text-base text-slate list-none m-0 p-0">
              {phoneLink && phoneFormatted && (
                <li>
                  <a href={phoneLink} className="inline-flex items-center gap-2 min-h-11 hover:text-ink transition-colors" aria-label={`Bel ons: ${phoneFormatted}`}>
                    <Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
                    {phoneFormatted}
                  </a>
                </li>
              )}
              {businessInfo.contact.email && (
                <li>
                  <a href={`mailto:${businessInfo.contact.email}`} className="inline-flex items-center min-h-11 hover:text-ink transition-colors break-all">
                    {businessInfo.contact.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </nav>
      </Drawer>

      {/* Zoeken — volledig scherm, focus direct in het veld */}
      <Dialog
        id="site-search"
        size="full"
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Zoeken"
        initialFocusRef={searchInputRef}
      >
        <div className="h-full flex items-center">
          <form onSubmit={handleSearch} role="search" className="w-full max-w-4xl mx-auto px-6 sm:px-10 lg:px-14 py-10">
            <label htmlFor="site-search-input" className="sr-only">Zoek in de webshop</label>
            <div className="relative">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-stone" strokeWidth={1.25} aria-hidden="true" />
              <input
                ref={searchInputRef}
                id="site-search-input"
                type="search"
                name="q"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Wat zoek je?"
                autoComplete="off"
                enterKeyHint="search"
                className="w-full text-2xl sm:text-4xl lg:text-5xl font-serif py-6 pl-12 sm:pl-16 bg-transparent border-0 border-b border-line-strong focus:outline-none focus:border-ink transition-colors"
              />
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <p className="eyebrow w-full mb-1">Veel gezocht</p>
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchQuery(term);
                    searchInputRef.current?.focus();
                  }}
                  className="inline-flex items-center min-h-11 px-4 rounded-full border border-line-strong text-base text-ink hover:border-ink hover:bg-bone transition-colors"
                >
                  {term}
                </button>
              ))}
              <button type="submit" className="btn-primary btn-sm ml-auto">
                Zoeken
              </button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Cart drawer */}
      <CartDrawer open={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />
    </>
  );
}
