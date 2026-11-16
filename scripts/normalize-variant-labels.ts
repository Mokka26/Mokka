// Verbeterplan 16 nov 2026 — CON-12/CON-7: kleurnamen (variantknoppen) en
// specificaties die klanten zien, in gewone Nederlandse woorden.
//
// Automatisch (voorstel):
//   - colorName en specs.Kleur/Stofkleur: leverancierscodes en afkortingen
//     eruit ("Zitting pp kussen pu grijs" → "Kunststof zitting, kussen
//     kunstleer grijs", "Ote share160 lichtgrijs" → "Lichtgrijs", "140- glanzend
//     steen Pandora" → "Glanzend steen Pandora"), Engelse kleurwoorden naar
//     Nederlands ("Boucle White" → "Bouclé wit"), eerste letter hoofdletter.
//   - specs.Zitcomfort: "60/70/80/90CM*" → "60/70/80/90 cm".
// Handmatig (alleen gemeld): opstellingscodes ("OTM+90/90", "+80+POEF"),
// onwaarschijnlijke maten (bank hoger dan 150 cm, bv. Finn 265 cm).
//
// Raakt alleen colorName en specs (nooit levertijd-specs, prijs, naam of slug).
// Aanvulling op scripts/normalize-spec-values.ts (materiaal/serie), geen overlap.
//
// Dry-run: node --env-file=.env.local --import tsx scripts/normalize-variant-labels.ts
// Apply:   node --env-file=.env.local --import tsx scripts/normalize-variant-labels.ts --apply
import {
  applyChanges, flag, loadProducts, parseSpecs, printSummary, propose, run, writeReport,
  type Change, type Flag,
} from "./catalog-shared";

const SCRIPT = "normalize-variant-labels";

/** Engelse kleur-/materiaalwoorden → Nederlands (woordniveau). */
const EN_NL: Record<string, string> = {
  "off white": "gebroken wit", black: "zwart", white: "wit", brown: "bruin", grey: "grijs", gray: "grijs",
  gold: "goud", silver: "zilver", green: "groen", blue: "blauw", natural: "naturel", walnut: "walnoot",
  oak: "eiken", cream: "crème", sand: "zand", boucle: "bouclé", velvet: "velours", bronze: "brons", brass: "messing",
};
const EN_RE = new RegExp(`\\b(${Object.keys(EN_NL).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");

/** Codes en afkortingen in kleurlabels (volgorde telt). */
const CODE_RULES: Array<{ re: RegExp; to: string; rule: string }> = [
  { re: /^zitting pp kussen pu /i, to: "Kunststof zitting, kussen kunstleer ", rule: "afkorting" },
  { re: /^micro fiber pu /i, to: "Microvezel kunstleer ", rule: "afkorting" },
  { re: /\brug pu\b/i, to: ", rug kunstleer", rule: "afkorting" },
  { re: /\bpu\b/i, to: "kunstleer", rule: "afkorting" },
  { re: /^ote share\s?\d+\s+/i, to: "", rule: "leverancierscode" },
  { re: /^davis perfect harmony (\d+) (.+)$/i, to: "$2 (stof Perfect Harmony $1)", rule: "leverancierscode" },
  { re: /^3-delig mango hout\b/i, to: "Mangohout", rule: "opmaak" },
  { re: /^\d{2,3}-\s*/, to: "", rule: "leverancierscode" },
];

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Eén label opschonen; geeft [nieuw label, toegepaste regels]. */
function cleanLabel(label: string): [string, string[]] {
  const rules: string[] = [];
  let out = label.trim();
  for (const r of CODE_RULES) {
    const next = out.replace(r.re, r.to);
    if (next !== out) rules.push(r.rule);
    out = next;
  }
  const translated = out.replace(EN_RE, (w: string) => EN_NL[w.toLowerCase()] ?? w);
  if (translated !== out) rules.push("engels");
  out = translated.replace(/\s+,/g, ",").replace(/ {2,}/g, " ").trim();
  // Kleurwoorden direct na een ander woord klein ("Bouclé Beige" → "Bouclé
  // beige"). Na een komma niet: "Beige, Bruin" zijn twee kleuren (filters).
  const lowered = out.replace(/(?<=[^\s,] )(Beige|Taupe|Zwart|Wit|Grijs|Bruin|Goud|Zilver|Groen|Blauw|Naturel|Crème|Zand)\b/g, (w) => w.toLowerCase());
  if (lowered !== out) rules.push("hoofdletter");
  out = lowered;
  // Eerste letter hoofdletter, rest zoals het staat (lowercase na de eerste
  // spatie alleen voor vertaalde woorden, gebeurt al via EN_NL).
  const cap = capitalize(out);
  if (cap !== out) rules.push("hoofdletter");
  return [cap, rules];
}

const SOFA = new Set(["banken", "bankstellen", "hoekbanken", "fauteuils"]);

run(async () => {
  const products = await loadProducts();
  const changes: Change[] = [];
  const flags: Flag[] = [];

  for (const p of products) {
    // colorName (variantknop)
    if (p.colorName) {
      const [next, rules] = cleanLabel(p.colorName);
      propose(changes, flags, p, "colorName", p.colorName, next, rules);
    }

    // specs
    const specs = parseSpecs(p.specs);
    if (Object.keys(specs).length === 0) continue;
    const nextSpecs = { ...specs };
    const specRules = new Set<string>();
    for (const key of ["Kleur", "Stofkleur"]) {
      const v = specs[key];
      if (!v) continue;
      const [next, rules] = cleanLabel(v);
      if (next !== v) {
        nextSpecs[key] = next;
        rules.forEach((r) => specRules.add(`${key}:${r}`));
      }
    }
    if (specs.Zitcomfort) {
      const z = specs.Zitcomfort.replace(/\*+$/, "").replace(/\s*CM\b/i, " cm").trim();
      if (z !== specs.Zitcomfort) {
        nextSpecs.Zitcomfort = z;
        specRules.add("Zitcomfort:opmaak");
      }
    }
    if (specRules.size > 0) {
      // Zelfde sleutelvolgorde; alleen gewijzigde waarden verschillen.
      propose(changes, flags, p, "specs", p.specs, JSON.stringify(nextSpecs), [...specRules]);
    }

    // Alleen melden
    for (const key of ["Opstelling", "Hoekmaat"]) {
      const v = specs[key];
      if (v && /[A-Z]{3}|\+/.test(v)) flag(flags, p, "specs", `${key}: ${v}`, "leverancierscode in specificatie — omschrijven of verbergen");
    }
    if (SOFA.has(p.category) && specs.Afmetingen) {
      const nums = [...specs.Afmetingen.matchAll(/(\d{2,3})(?:[.,]\d+)?/g)].map((m) => Number(m[1]));
      const last = nums[nums.length - 1];
      if (nums.length >= 3 && last !== undefined && last > 150) {
        flag(flags, p, "specs", `Afmetingen: ${specs.Afmetingen}`, `hoogte ${last} cm is onwaarschijnlijk voor een bank — maat nakijken`);
      }
    }
  }

  const report = writeReport(SCRIPT, changes, flags, { products: products.length, changes: changes.length, flags: flags.length });
  printSummary(SCRIPT, changes, flags, report);
  await applyChanges(SCRIPT, changes);
});
