// Kleurvarianten (zelfde colorGroup) samenvoegen tot één kaart met swatches.
// Pure functie, gedeeld door app/products/page.tsx (server-side, vóór het
// pagineren — zodat varianten niet over een paginagrens verdeeld raken) en
// ProductsContent.tsx (client-side, na een filter-fetch).

export interface ColorVariant {
  slug: string;
  colorName: string | null;
  colorHex: string | null;
}

interface Groupable {
  id: string;
  slug: string;
  colorGroup?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  variants?: ColorVariant[];
}

export function dedupeByColorGroup<T extends Groupable>(products: T[]): (T & { variants?: ColorVariant[] })[] {
  const groups = new Map<string, T[]>();
  const standalone: T[] = [];

  for (const p of products) {
    if (p.colorGroup) {
      const arr = groups.get(p.colorGroup) ?? [];
      arr.push(p);
      groups.set(p.colorGroup, arr);
    } else {
      standalone.push(p);
    }
  }

  const out: (T & { variants?: ColorVariant[] })[] = [...standalone];
  for (const items of groups.values()) {
    const primary = items[0];
    // Al eerder (server-side) samengevoegd en nu alleen als primaire kaart
    // aanwezig: bestaande swatches behouden i.p.v. ze te reduceren tot één.
    const variants =
      items.length === 1 && primary.variants && primary.variants.length > 1
        ? primary.variants
        : items.map((v) => ({ slug: v.slug, colorName: v.colorName ?? null, colorHex: v.colorHex ?? null }));
    out.push({ ...primary, variants });
  }

  // Originele volgorde (nieuwste eerst) terugzetten.
  const orderMap = new Map(products.map((p, i) => [p.id, i]));
  out.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  return out;
}
