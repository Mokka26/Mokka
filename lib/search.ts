import type { Prisma } from "@prisma/client";
import { CATEGORIES } from "@/lib/categories";

/**
 * Zoekwoorden uit de zoekbalk: kleine letters, zonder leestekens, max. 5 woorden.
 * Meervoud wordt ingekort ("hoekbanken" → "hoekbank", "eettafels" → "eettafel",
 * "eiken" → "eik") zodat enkel- en meervoud elkaar vinden.
 */
export function searchTerms(q: string): string[] {
  const words = q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accenten (crème → creme, i̇ → i)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  return [...new Set(words.map(stem))].slice(0, 5);
}

function stem(w: string): string {
  if (w.length >= 6 && w.endsWith("en")) return w.slice(0, -2);
  if (w.length >= 5 && w.endsWith("s")) return w.slice(0, -1);
  if (w.length === 5 && w.endsWith("en")) return w.slice(0, -2);
  // Buigings-e: "ronde" → "rond", "ovale" → "oval" (specs zeggen "Rond", "Ovaal").
  if (w.length >= 5 && w.endsWith("e") && !w.endsWith("ee") && !ACCENTED[w]) return w.slice(0, -1);
  return w;
}

/**
 * De database vergelijkt accenten exact ("boucle" vindt "Bouclé" niet). Voor de
 * woorden die in de catalogus mét accent staan, zoeken we beide schrijfwijzen.
 */
const ACCENTED: Record<string, string> = {
  boucle: "bouclé",
  creme: "crème",
  cafe: "café",
};

function variantsOf(term: string): string[] {
  const accented = ACCENTED[term];
  return accented && accented !== term ? [term, accented] : [term];
}

/** Product-categorieën (DB-waarden) waarvan slug of label het woord bevat. */
function categoriesFor(term: string): string[] {
  const out = new Set<string>();
  for (const c of CATEGORIES) {
    if (c.slug.includes(term) || c.label.toLowerCase().includes(term)) {
      for (const db of c.dbCategories) out.add(db);
    }
  }
  return [...out];
}

/**
 * Prisma-filter: élk woord moet ergens voorkomen (naam, kleur, specificaties
 * zoals materiaal/maat, of de categorie). "eettafel eiken" vindt zo eiken
 * eettafels, "salon tafel" de salontafels en "hoekbanken" de hoekbanken.
 */
export function buildSearchWhere(q: string): Prisma.ProductWhereInput | null {
  const terms = searchTerms(q);
  if (terms.length === 0) return null;
  return {
    AND: terms.map((t) => {
      const cats = categoriesFor(t);
      return {
        OR: [
          ...variantsOf(t).flatMap((v) => [
            { name: { contains: v, mode: "insensitive" as const } },
            { colorName: { contains: v, mode: "insensitive" as const } },
            { specs: { contains: v, mode: "insensitive" as const } },
          ]),
          ...(cats.length > 0 ? [{ category: { in: cats } }] : []),
        ],
      };
    }),
  };
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/**
 * Zelfde logica als buildSearchWhere, maar in het geheugen (voor gecachte
 * productlijsten, bv. /products). Accenten tellen hier niet mee.
 */
export function matchesSearch(
  p: { name: string; colorName?: string | null; specs?: string | null; category: string },
  terms: ReadonlyArray<string>,
): boolean {
  if (terms.length === 0) return true;
  const hay = fold(`${p.name} ${p.colorName ?? ""} ${p.specs ?? ""}`);
  return terms.every((t) => hay.includes(fold(t)) || categoriesFor(t).includes(p.category));
}
