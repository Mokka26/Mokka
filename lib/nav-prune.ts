/** Menu-item met optionele submenu-groepen (structuur van components/Navbar). */
export type PrunableNavItem = {
  subLinks?: ReadonlyArray<{ heading: string; links: ReadonlyArray<{ label: string; href: string }> }>;
};

/**
 * Haalt submenu-links naar lege categorieën weg (0 zichtbare producten) en
 * laat lege groepen vallen. Zo linkt het menu nooit naar "Nog geen producten".
 */
export function pruneEmptyLinks<T extends PrunableNavItem>(items: ReadonlyArray<T>, emptyHrefs: ReadonlySet<string>): T[] {
  if (emptyHrefs.size === 0) return [...items];
  return items.map((item) => {
    if (!item.subLinks) return item;
    const subLinks = item.subLinks
      .map((g) => ({ ...g, links: g.links.filter((l) => !emptyHrefs.has(l.href)) }))
      .filter((g) => g.links.length > 0);
    return { ...item, subLinks };
  });
}

/** `/slug` van niet-umbrella categorieën zonder zichtbare producten. */
export function emptyCategoryHrefs(counts: Record<string, number>, slugs: ReadonlyArray<string>): string[] {
  return slugs.filter((s) => (counts[s] ?? 0) === 0).map((s) => `/${s}`);
}
