/**
 * Browser-events tussen losse client-componenten. Bewust een eigen, piepklein
 * bestand: wie de constante importeert, mag niet de hele component-module
 * (en alles wat die importeert) in zijn bundel trekken.
 */

/** Vraagt de Navbar de winkelwagen-lade te openen (na "In winkelwagen"; cancelable). */
export const OPEN_CART_EVENT = "mokka:open-cart";
