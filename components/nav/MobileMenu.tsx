"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Phone, Search } from "lucide-react";
import { Drawer } from "@/components/ui/Dialog";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { MOBILE_MENU_ID } from "@/lib/events";
import { navSlug, type NavItem } from "@/components/nav/nav-types";

/** Service-pagina's in het mobiele menu (bestaande routes). */
const SERVICE_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/showroom", label: "Showroom" },
  { href: "/bezorging", label: "Bezorging" },
  { href: "/retourneren", label: "Retourneren" },
  { href: "/gids", label: "Koopgidsen" },
  { href: "/contact", label: "Contact" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Menu-items (al zonder lege categorieën). */
  items: ReadonlyArray<NavItem>;
  /** "Zoek een product": sluit het menu en opent de zoekdialoog. */
  onOpenSearch: () => void;
}

/**
 * Mobiel menu — native dialog: focus blijft erin, Esc sluit, focus terug naar
 * de knop. Losse module die de Navbar pas laadt bij de eerste klik op de
 * menuknop (next/dynamic), zodat hij niet in de JS van elke pagina zit. Alle
 * categorielinks staan ook in de footer (server-HTML), dus geen SEO-verlies.
 */
export default function MobileMenu({ open, onClose, items, onOpenSearch }: Props) {
  const [activeMobileItem, setActiveMobileItem] = useState<string | null>(null);
  const phoneLink = getPhoneLink();
  const phoneFormatted = businessInfo.contact.phoneFormatted;

  return (
    <Drawer id={MOBILE_MENU_ID} side="left" open={open} onClose={onClose} title="Menu">
      <nav aria-label="Mobiele navigatie" className="px-6 py-6">
        {/* Zoeken ook vanuit het menu (op mobiel staat de zoekknop klein in de balk). */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center gap-3 min-h-12 px-4 mb-4 rounded-[10px] border border-line-strong text-base text-graphite hover:border-ink transition-colors"
        >
          <Search className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
          Zoek een product
        </button>
        <ul className="list-none m-0 p-0">
          {items.map((item) => {
            const expanded = activeMobileItem === item.label;
            const panelId = `mobile-submenu-${navSlug(item.label)}`;
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
                    {/* Altijd gerenderd; ingeklapt via grid-rows 0fr + inert
                        (niet focusbaar, niet in de accessibility tree). */}
                    <div
                      id={panelId}
                      className={`grid motion-safe:transition-[grid-template-rows,opacity] duration-300 ease-out ${
                        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                      inert={!expanded}
                    >
                      <div className="overflow-hidden min-h-0">
                        <div className="pb-5 space-y-5">
                          {item.subLinks.map((group) => (
                            <div key={group.heading}>
                              <p className="eyebrow mb-2">{group.heading}</p>
                              <ul className="list-none m-0 p-0">
                                {group.links.map((l) => (
                                  <li key={l.label}>
                                    <Link
                                      href={l.href}
                                      onClick={onClose}
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
                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center py-4 min-h-14 font-serif text-2xl text-ink hover:text-accent-dark"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {/* Service: showroom en praktische info ook in het mobiele menu. */}
        <div className="mt-8 pt-6 border-t border-line">
          <p className="eyebrow mb-3">Service</p>
          <ul className="space-y-1 text-base text-slate list-none m-0 p-0">
            {SERVICE_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={onClose}
                  className="inline-flex items-center min-h-11 hover:text-ink transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

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
  );
}
