/**
 * Aantal modellen zoals de categorielijst ze toont: alle varianten met
 * dezelfde `colorGroup` (maten en kleuren) zijn samen één kaart; producten
 * zonder colorGroup tellen elk als één. Eén regel voor de homepage-tegels,
 * de subcategorie-chips en de lijst zelf (zie groupModels in
 * app/[category]/category-page.tsx), zodat de aantallen overal gelijk zijn.
 *
 * `count` = aantal producten in die rij (bv. uit een Prisma-groupBy); voor
 * losse producten 1.
 */
export interface ModelCountRow {
  colorGroup: string | null;
  count: number;
}

export function countModels(rows: Iterable<ModelCountRow>): number {
  let ungrouped = 0;
  const groups = new Set<string>();
  for (const row of rows) {
    if (row.count <= 0) continue;
    if (row.colorGroup) groups.add(row.colorGroup);
    else ungrouped += row.count;
  }
  return ungrouped + groups.size;
}
