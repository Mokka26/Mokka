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
 * Woorden die in de catalogus mét accent staan; stem() laat hun slot-e staan
 * ("boucle" niet inkorten tot "boucl").
 */
const ACCENTED: Record<string, string> = {
  boucle: "bouclé",
  creme: "crème",
  cafe: "café",
};

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

function fold(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/**
 * Zoeken in het geheugen (gecachte productlijsten, bv. /products): élk woord
 * moet ergens voorkomen (naam, kleur, specificaties zoals materiaal/maat, of
 * de categorie). "eettafel eiken" vindt zo eiken eettafels, "salon tafel" de
 * salontafels. Accenten tellen niet mee.
 */
export function matchesSearch(
  p: { name: string; colorName?: string | null; specs?: string | null; category: string },
  terms: ReadonlyArray<string>,
): boolean {
  if (terms.length === 0) return true;
  const hay = fold(`${p.name} ${p.colorName ?? ""} ${p.specs ?? ""}`);
  return terms.every((t) => hay.includes(fold(t)) || categoriesFor(t).includes(p.category));
}
