// Verbeterplan 16 nov 2026 — CON-13: productnamen consistent volgens
// "Type Model – kleur/maat" (zoals de meeste namen al zijn).
//
// Automatisch (voorstel):
//   1. type-ontbreekt: producttype vooraan als het nergens in de naam staat
//      ("Beaunan 240cm" in eettafels → "Eettafel Beaunan 240 cm"). Alleen
//      voor categorieën met één eenduidig type.
//   2. dubbel-woord: "Wandspiegel Spiegel 120×80" → "Wandspiegel 120×80".
//   3. engels: Engelse kleur-/vormwoorden ná het eerste woord naar
//      Nederlands ("Oval Black" → "ovaal zwart"); staat het Nederlandse woord
//      er al, dan valt het Engelse weg ("Kimberly Black Bijzettafel … Zwart").
//      Het eerste woord blijft altijd staan (vaak de modelnaam: "Brown Dressoir").
//   4. maat-opmaak: "240cm" → "240 cm", "160X100" → "160×100", "Ø45" → "Ø 45".
// Alleen gemeld: namen in HOOFDLETTERS, leverancierscodes, het merk "Brix"
// in de naam (eigenaar beslist), Engelse typewoorden ("Sofa", "Set").
//
// Raakt alleen Product.name — NIET de slug/URL (die blijft gelijk; Nederlandse
// URL's met doorverwijzing is een apart besluit, SEO-4).
//
// Dry-run: node --env-file=.env.local --import tsx scripts/normalize-product-names.ts
// Apply:   node --env-file=.env.local --import tsx scripts/normalize-product-names.ts --apply
import {
  applyChanges, flag, loadProducts, printSummary, propose, run, writeReport,
  type Change, type Flag,
} from "./catalog-shared";

const SCRIPT = "normalize-product-names";

/** Categorie → [type om vooraan te zetten, woorden die al als type tellen]. */
const TYPE: Record<string, [string, RegExp]> = {
  eettafels: ["Eettafel", /tafel|table/i],
  salontafels: ["Salontafel", /tafel|table/i],
  bijzettafels: ["Bijzettafel", /tafel|table|kruk|stool/i],
  fauteuils: ["Fauteuil", /fauteuil|stoel|chair|sofa/i],
  eetkamerstoelen: ["Eetkamerstoel", /stoel|chair|kruk|bank/i],
  dressoirs: ["Dressoir", /dressoir|sideboard|kast/i],
  spiegels: ["Spiegel", /spiegel|mirror/i],
  plafondlampen: ["Plafondlamp", /lamp/i],
  vloerlampen: ["Vloerlamp", /lamp/i],
  tafellampen: ["Tafellamp", /lamp/i],
  hoekbanken: ["Hoekbank", /bank/i],
  kledingkasten: ["Kledingkast", /kast/i],
  schoenenkasten: ["Schoenenkast", /kast/i],
  kapstokken: ["Kapstok", /kapstok|garderobe/i],
};

const EN_NL: Array<[RegExp, string]> = [
  [/\bset of (\d+)\b/gi, "set van $1"],
  [/\boff white\b/gi, "gebroken wit"],
  [/\bround\b/gi, "rond"],
  [/\boval\b/gi, "ovaal"],
  [/\bblack\b/gi, "zwart"],
  [/\bbrown\b/gi, "bruin"],
  [/\bwhite\b/gi, "wit"],
  [/\bwalnut\b/gi, "walnoot"],
  [/\boak\b/gi, "eiken"],
  [/\bnatural\b/gi, "naturel"],
  [/\bgr[ae]y\b/gi, "grijs"],
  [/\bcream\b/gi, "crème"],
  [/\bbrass\b/gi, "messing"],
];

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function fixEnglish(name: string, rules: Set<string>): string {
  const [first, ...rest] = name.split(" ");
  if (rest.length === 0) return name;
  let tail = rest.join(" ");
  // Direct vóór een typewoord hoort het Engelse woord bij de modelnaam
  // ("Kimberly Brown Eettafel", "Monza Oak Salontafel") → laten staan.
  const beforeType = "(?!\\s+\\w*(?:tafel|dressoir|kast|meubel|spiegel|lamp|stoel|bank))";
  for (const [base, nl] of EN_NL) {
    const re = new RegExp(base.source + beforeType, base.flags);
    tail = tail.replace(re, (m: string, ...g: unknown[]) => {
      const repl = nl.replace("$1", typeof g[0] === "string" ? g[0] : "");
      rules.add("engels");
      // Nederlands woord staat er al → Engels weghalen in plaats van dubbel.
      return new RegExp(`\\b${repl}\\b`, "i").test(fold(name)) && !/\d/.test(repl) ? "" : repl;
    });
  }
  return `${first} ${tail}`.replace(/ {2,}/g, " ").trim();
}

function fixDouble(name: string, rules: Set<string>): string {
  const out = name
    .replace(/\b(\w*(spiegel|tafel|lamp|kast|bank|stoel))\s+\2\b/gi, "$1")
    .replace(/\b(\p{L}{3,})\s+\1\b/giu, "$1");
  if (out !== name) rules.add("dubbel-woord");
  return out;
}

function fixSizes(name: string, rules: Set<string>): string {
  const out = name
    .replace(/(\d)\s*cm\b/gi, "$1 cm")
    .replace(/(\d)\s*[xX]\s*(?=\d)/g, "$1×")
    .replace(/Ø\s*(\d)/g, "Ø $1");
  if (out !== name) rules.add("maat-opmaak");
  return out;
}

run(async () => {
  const products = await loadProducts();
  const changes: Change[] = [];
  const flags: Flag[] = [];

  for (const p of products) {
    const rules = new Set<string>();
    if (/^[^a-z]*[A-Z]{3,}[^a-z]*$/.test(p.name)) {
      flag(flags, p, "name", p.name, "naam in HOOFDLETTERS — handmatig herschrijven");
      continue;
    }
    let name = p.name.trim();
    name = fixDouble(name, rules);
    name = fixEnglish(name, rules);
    name = fixSizes(name, rules);

    const type = TYPE[p.category];
    if (type && !type[1].test(name)) {
      name = `${type[0]} ${name}`;
      rules.add("type-ontbreekt");
    }
    name = name.replace(/ {2,}/g, " ").trim();
    propose(changes, flags, p, "name", p.name, name, [...rules]);

    if (/\bBrix\b/.test(p.name)) flag(flags, p, "name", p.name, "merknaam Brix in de naam — houden of weglaten? (eigenaar)");
    if (/\b(sofa|set|stool|table|chair)\b/i.test(name)) flag(flags, p, "name", name, "Engels typewoord — handmatig");
    if (/\b[A-Z]{2,}[-\d]{2,}\b|\b[A-Z]{2,}\d+\b/.test(p.name)) flag(flags, p, "name", p.name, "lijkt een leverancierscode — handmatig");
  }

  const report = writeReport(SCRIPT, changes, flags, { products: products.length, changes: changes.length, flags: flags.length });
  printSummary(SCRIPT, changes, flags, report);
  await applyChanges(SCRIPT, changes);
});
