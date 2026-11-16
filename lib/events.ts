/**
 * Browser-events tussen losse client-componenten. Bewust een eigen, piepklein
 * bestand: wie de constante importeert, mag niet de hele component-module
 * (en alles wat die importeert) in zijn bundel trekken.
 */

/** Vraagt de Navbar de winkelwagen-lade te openen (na "In winkelwagen"; cancelable). */
export const OPEN_CART_EVENT = "mokka:open-cart";

/**
 * Element-id's van de lui geladen header-dialogen (aria-controls op de
 * knoppen). Hier en niet in de component-modules zelf: de Navbar laadt die
 * via next/dynamic pas bij de eerste klik, een statische import van een
 * constante zou de hele module weer in de basisbundel trekken.
 */
export const CART_DRAWER_ID = "cart-drawer";
export const SEARCH_DIALOG_ID = "site-search";
export const MOBILE_MENU_ID = "mobile-menu";
