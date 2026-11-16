"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { Search, ShoppingBag, Menu, ChevronDown, Phone } from "lucide-react";
import TopBanner from "./TopBanner";
import { CART_DRAWER_ID, MOBILE_MENU_ID, OPEN_CART_EVENT, SEARCH_DIALOG_ID } from "@/lib/events";
import { pruneEmptyLinks } from "@/lib/nav-prune";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { isCheckoutFlow } from "@/components/checkout/CheckoutGate";
import { navSlug as slug, type NavItem } from "@/components/nav/nav-types";

// Winkelwagen-lade, zoekdialoog en mobiel menu zitten niet in de basisbundel:
// ze laden pas bij de eerste klik (of al bij hover/focus/touch op de knop,
// zie `warm`). Daarna blijven ze gemount zodat sluit-animaties en state werken.
const CartDrawer = dynamic(() => import("./CartDrawer"), { ssr: false });
const SearchDialog = dynamic(() => import("./nav/SearchDialog"), { ssr: false });
const MobileMenu = dynamic(() => import("./nav/MobileMenu"), { ssr: false });

const warm = {
  cart: () => void import("./CartDrawer"),
  search: () => void import("./nav/SearchDialog"),
  menu: () => void import("./nav/MobileMenu"),
};

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
    label: "Verlichting & spiegels",
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
  { label: "Aanbiedingen", href: "/aanbiedingen", secondary: true },
  { label: "Over ons", href: "/about", secondary: true },
];

const MORE_LABEL = "Meer";

// "Meer"-item (alleen lg–2xl): bundelt de secundaire items in één dropdown.
const moreItem: NavItem = {
  label: MORE_LABEL,
  href: navItems.find((i) => i.secondary)?.href ?? "/",
  subLinks: [
    {
      heading: "Meer",
      links: navItems.filter((i) => i.secondary).map(({ label, href }) => ({ label, href })),
    },
  ],
};

// Icoonknop in de header: 44×44 touch target, zichtbare hover + focus.
const iconButton =
  "relative inline-flex items-center justify-center w-11 h-11 rounded-full text-ink hover:text-accent-dark hover:bg-bone transition-colors duration-[280ms]";

// Desktop-navigatie-item: 16px, compacte spacing op lg (1024px), ruimer vanaf 2xl.
const desktopItemClass =
  "relative flex items-center gap-1 lg:px-2 xl:gap-1.5 xl:px-2.5 2xl:px-3 min-h-11 text-base font-medium whitespace-nowrap transition-colors duration-300";
const desktopUnderlineClass =
  "pointer-events-none absolute bottom-1 left-2 right-2 xl:left-2.5 xl:right-2.5 2xl:left-3 2xl:right-3 h-px bg-accent-dark origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";
// Item mét submenu: link (naar de categorie) + losse chevron-knop ernaast.
const desktopSplitLinkClass =
  "relative flex items-center lg:pl-2 lg:pr-1 xl:pl-2.5 2xl:pl-3 min-h-11 text-base font-medium whitespace-nowrap transition-colors duration-300";
const desktopSplitUnderlineClass =
  "pointer-events-none absolute bottom-1 left-2 right-1 xl:left-2.5 2xl:left-3 h-px bg-accent-dark origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

// Bewegingen in de header zijn puur CSS (geen framer-motion in de root-bundle):
//  - dropdown: fade-in via de mk-fade-in keyframes uit globals.css
//  - mobiel submenu: grid-template-rows 0fr → 1fr (animatie naar height:auto)
//  - topbanner: max-height + opacity bij scrollen
// `motion-safe:` respecteert prefers-reduced-motion.
const dropdownPanelClass =
  "absolute top-full pt-2 z-50 motion-safe:animate-[mk-fade-in_200ms_var(--ease-out-soft)]";

/** `emptyCategoryHrefs`: categorieën zonder zichtbare producten (uit de root-layout). */
export default function Navbar({ emptyCategoryHrefs = [] }: { emptyCategoryHrefs?: ReadonlyArray<string> }) {
  const pathname = usePathname();
  // Geen menulinks naar lege categorieën (bv. Nachtkastjes met 0 producten).
  const menuItems = useMemo(
    () => pruneEmptyLinks(navItems, new Set(emptyCategoryHrefs)),
    [emptyCategoryHrefs],
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  // Pas na de eerste keer openen gemount (en dus pas dan geladen).
  const [mounted, setMounted] = useState({ cart: false, search: false, menu: false });
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const { totalItems } = useCart();

  const openCartDrawer = () => {
    setMounted((m) => (m.cart ? m : { ...m, cart: true }));
    setCartDrawerOpen(true);
  };
  const openSearch = () => {
    setMounted((m) => (m.search ? m : { ...m, search: true }));
    setSearchOpen(true);
  };
  const openMobileMenu = () => {
    setMounted((m) => (m.menu ? m : { ...m, menu: true }));
    setMobileMenuOpen(true);
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // PDP "In winkelwagen" → open de drawer (event uit ProductDetailClient).
  useEffect(() => {
    const openCart = (e: Event) => {
      e.preventDefault();
      setMounted((m) => (m.cart ? m : { ...m, cart: true }));
      setCartDrawerOpen(true);
    };
    window.addEventListener(OPEN_CART_EVENT, openCart);
    return () => window.removeEventListener(OPEN_CART_EVENT, openCart);
  }, []);

  // /admin heeft een eigen layout; /checkout een kale header (app/checkout/layout.tsx).
  if (pathname?.startsWith("/admin") || isCheckoutFlow(pathname)) return null;

  const phoneLink = getPhoneLink();
  const phoneFormatted = businessInfo.contact.phoneFormatted;

  const cartLabel =
    totalItems === 0
      ? "Winkelwagen, leeg"
      : `Winkelwagen, ${totalItems} ${totalItems === 1 ? "artikel" : "artikelen"}`;

  return (
    <>
      {/* Gewone <header>, geen entree-animatie: de header staat direct in de
          eerste paint en wordt niet verborgen tot hydratie. */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,box-shadow] duration-500 ${
          scrolled ? "bg-paper border-b border-line shadow-[0_1px_0_rgba(20,17,13,0.04)]" : "bg-paper border-b border-transparent"
        }`}
        onMouseLeave={() => setActiveDropdown(null)}
      >
        {/* Top banner — klapt in bij scroll (max-height 36px → 0) */}
        <div
          className={`overflow-hidden motion-safe:transition-[max-height,opacity] duration-300 ease-out ${
            scrolled ? "max-h-0 opacity-0" : "max-h-9 opacity-100"
          }`}
          aria-hidden={scrolled}
        >
          <TopBanner />
        </div>

        <div className="max-w-page mx-auto">
          <nav aria-label="Hoofdnavigatie" className="flex items-center justify-between gap-2 min-[375px]:gap-4 h-16 lg:h-20 px-4 min-[375px]:px-6 sm:px-10 lg:px-8 2xl:px-14">
            {/* Logo links */}
            <Link href="/" className="flex-shrink-0 inline-flex items-center min-h-11" aria-label="Mokka Home Interior — naar de homepage">
              {/* 480×166 PNG (20 kB). Geen priority/preload: het logo is klein
                  en staat direct in de HTML; eager zodat 'ie niet op layout wacht. */}
              <Image
                src="/images/logo.png"
                alt=""
                width={160}
                height={55}
                className="h-10 sm:h-12 2xl:h-14 w-auto"
                loading="eager"
              />
            </Link>

            {/* Desktop navigation — vanaf lg (1024px) met 16px-items. Tussen lg en
                xl staan de secundaire items in "Meer"; vanaf xl staat alles naast elkaar. */}
            <ul className="hidden lg:flex items-center list-none m-0 p-0">
              {[...menuItems, moreItem].map((item) => {
                const isOpen = activeDropdown === item.label;
                const panelId = `submenu-${slug(item.label)}`;
                const isMore = item.label === MORE_LABEL;
                const visibility = isMore ? "2xl:hidden" : item.secondary ? "hidden 2xl:block" : "";
                const toggle = () => setActiveDropdown(isOpen ? null : item.label);
                const chevron = (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                );
                return (
                  <li
                    key={item.label}
                    className={`relative group ${item.subLinks && !isMore ? "flex items-center" : ""} ${visibility}`}
                    // Muis: submenu opent bij hover. Toetsenbord: disclosure-patroon,
                    // het submenu opent alleen via de chevron-knop (niet bij focus),
                    // dus geen tientallen extra tabstops voor de content.
                    onMouseEnter={() => item.subLinks && setActiveDropdown(item.label)}
                    onMouseLeave={() => item.subLinks && setActiveDropdown(null)}
                    // Sluit zodra de focus de groep verlaat.
                    onBlur={(e) => {
                      if (item.subLinks && isOpen && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        setActiveDropdown(null);
                      }
                    }}
                    // Esc sluit het submenu en zet de focus terug op de knop (WCAG 1.4.13).
                    onKeyDown={(e) => {
                      if (e.key !== "Escape" || !item.subLinks || !isOpen) return;
                      e.stopPropagation();
                      setActiveDropdown(null);
                      e.currentTarget.querySelector<HTMLElement>("button")?.focus();
                    }}
                  >
                    {isMore ? (
                      // "Meer" is geen pagina: een knop die alleen het menu opent.
                      <button
                        type="button"
                        onClick={toggle}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className={`${desktopItemClass} ${isOpen ? "text-accent-dark" : "text-ink group-hover:text-accent-dark"}`}
                      >
                        {item.label}
                        {chevron}
                        <span aria-hidden="true" className={`${desktopUnderlineClass} ${isOpen ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
                      </button>
                    ) : item.subLinks ? (
                      <>
                        {/* Hoofdlink blijft een gewone link naar de categorie. */}
                        <Link
                          href={item.href}
                          className={`${desktopSplitLinkClass} ${isOpen ? "text-accent-dark" : "text-ink group-hover:text-accent-dark"}`}
                        >
                          {item.label}
                          <span aria-hidden="true" className={`${desktopSplitUnderlineClass} ${isOpen ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
                        </Link>
                        <button
                          type="button"
                          onClick={toggle}
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          aria-label={`Submenu ${item.label}`}
                          className={`inline-flex items-center justify-center w-6 min-h-11 rounded-[6px] transition-colors duration-300 ${isOpen ? "text-accent-dark" : "text-ink group-hover:text-accent-dark"}`}
                        >
                          {chevron}
                        </button>
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        className={`${desktopItemClass} text-ink group-hover:text-accent-dark`}
                      >
                        {item.label}
                        {/* Fijne onderlijn, verschijnt bij hover */}
                        <span aria-hidden="true" className={`${desktopUnderlineClass} scale-x-0 group-hover:scale-x-100`} />
                      </Link>
                    )}

                    {/* Compact dropdown — verankerd onder het item */}
                    {item.subLinks && isOpen && (
                      <div id={panelId} className={`${dropdownPanelClass} ${isMore ? "right-0" : "left-0"}`}>
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
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Acties rechts: bellen, zoeken, winkelwagen, menu. Onder 375px valt
                het bel-icoon weg (het nummer staat in het mobiele menu), zodat de
                menuknop op 320–374px binnen beeld blijft. Vanaf xl staat het nummer
                als tekst in de header. */}
            <div className="flex items-center gap-0.5 min-[375px]:gap-1 sm:gap-2">
              {phoneLink && phoneFormatted && (
                <a
                  href={phoneLink}
                  className={`${iconButton} max-[374px]:hidden xl:w-auto xl:px-4 xl:gap-2 xl:rounded-full`}
                  aria-label={`Bel ons: ${phoneFormatted}`}
                >
                  <Phone className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
                  <span className="hidden xl:inline text-base font-medium whitespace-nowrap tabular-nums">{phoneFormatted}</span>
                </a>
              )}
              <button
                type="button"
                onClick={openSearch}
                onPointerEnter={warm.search}
                onFocus={warm.search}
                className={iconButton}
                aria-label="Zoeken"
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                aria-controls={mounted.search ? SEARCH_DIALOG_ID : undefined}
              >
                <Search className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={openCartDrawer}
                onPointerEnter={warm.cart}
                onFocus={warm.cart}
                className={iconButton}
                aria-label={cartLabel}
                aria-haspopup="dialog"
                aria-expanded={cartDrawerOpen}
                aria-controls={mounted.cart ? CART_DRAWER_ID : undefined}
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
                {totalItems > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-0.5 min-w-5 h-5 px-1 rounded-full bg-ink text-paper text-sm leading-5 text-center font-medium tabular-nums"
                  >
                    {totalItems}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={openMobileMenu}
                onPointerEnter={warm.menu}
                onFocus={warm.menu}
                onTouchStart={warm.menu}
                className={`lg:hidden ${iconButton}`}
                aria-label="Menu openen"
                aria-haspopup="dialog"
                aria-expanded={mobileMenuOpen}
                aria-controls={mounted.menu ? MOBILE_MENU_ID : undefined}
              >
                <Menu className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobiel menu, zoeken en winkelwagen: lui geladen, pas gemount na de
          eerste keer openen (zie de dynamic-imports bovenaan). */}
      {mounted.menu && (
        <MobileMenu
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          items={menuItems}
          onOpenSearch={() => {
            setMobileMenuOpen(false);
            openSearch();
          }}
        />
      )}

      {mounted.search && <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />}

      {mounted.cart && <CartDrawer open={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />}
    </>
  );
}
