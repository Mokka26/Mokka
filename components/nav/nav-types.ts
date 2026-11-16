/** Gedeelde types/helpers voor de Navbar en het (lui geladen) mobiele menu. */

export interface SubLink { label: string; href: string }

export interface NavItem {
  label: string;
  href: string;
  subLinks?: { heading: string; links: SubLink[] }[];
  /**
   * Secundaire items staan tussen lg (1024px) en 2xl (1536px) samen in een
   * "Meer"-dropdown, zodat de desktopnavigatie (met vanaf xl het
   * telefoonnummer als tekst) past zonder onder 16px te gaan. Vanaf 2xl
   * staan ze gewoon naast de andere items.
   */
  secondary?: boolean;
}

/** Id-veilige vorm van een menulabel (aria-controls van submenu's). */
export const navSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
