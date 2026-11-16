// Verbeterplan 16 nov 2026 — CON-8/CON-9: ongefundeerde superlatieven en
// marketingclaims uit productbeschrijvingen, en "u/uw" → "je".
//
// Vaste, controleerbare herschrijvingen (CLAUDE.md §4: geen "uniek",
// "premium", "de beste"; brand.md: geen "statement piece", "trendy"):
//   - "uniek(e)" als bijvoeglijk naamwoord weg; "een uniek karakter" → "een
//     eigen karakter"; "elke tafel uniek" → "elke tafel anders"
//   - "hoogwaardig(e)" weg ("van hoogwaardig mangohout" → "van mangohout")
//   - "luxueuze" → "verzorgde"; "luxe" alleen weg in "luxe en …" en ", luxe …"
//   - "statement" → "blikvanger"; "trendy" weg; "een waar pronkstuk" → "een blikvanger"
//   - "uw" → "je", "haalt u" → "haal je"
// Wat niet veilig automatisch kan (bv. "verfijnde luxe", "meesterwerk",
// "premium", "de beste", "must-have", losse "u") komt als "handmatig" in het rapport.
// Stofnamen als "Luxe Velvet 260" blijven staan.
//
// Raakt alleen Product.description; levertijdzinnen blijven letterlijk staan.
//
// Dry-run: node --env-file=.env.local --import tsx scripts/fix-marketing-claims.ts
// Apply:   node --env-file=.env.local --import tsx scripts/fix-marketing-claims.ts --apply
import {
  applyChanges, flag, loadProducts, printSummary, propose, replaceKeepCase, run, tidy, writeReport,
  type Change, type Flag,
} from "./catalog-shared";

const SCRIPT = "fix-marketing-claims";

type Rule = { name: string; re: RegExp; to: string };

const RULES: Rule[] = [
  // uniek
  { name: "uniek", re: /\been uniek karakter\b/gi, to: "een eigen karakter" },
  { name: "uniek", re: /\b(elke|iedere) (\w+) uniek\b/gi, to: "$1 $2 anders" },
  { name: "uniek", re: /\bmaakt deze collectie uniek\b/gi, to: "geeft deze collectie karakter" },
  { name: "uniek", re: /\been uniek en /gi, to: "een " },
  { name: "uniek", re: /\bdeze unieke combinatie\b/gi, to: "deze combinatie" },
  { name: "uniek", re: /\b(de|een|het|deze|elk|met) unieke? /gi, to: "$1 " },
  // hoogwaardig
  { name: "hoogwaardig", re: /\b(een|het|de|van|uit) hoogwaardige? /gi, to: "$1 " },
  // luxe
  { name: "luxe", re: /\bluxueuze\b/gi, to: "verzorgde" },
  { name: "luxe", re: /\been luxe en (\w+)/gi, to: "een $1" },
  { name: "luxe", re: /, luxe (uitstraling|look)\b/gi, to: " $1" },
  // statement / trendy / pronkstuk
  { name: "statement", re: /\been krachtig statement\b/gi, to: "een blikvanger" },
  { name: "statement", re: /\been decoratief statement\b/gi, to: "een decoratieve blikvanger" },
  { name: "trendy", re: /\b(verfijnde) en trendy\b/gi, to: "$1" },
  { name: "trendy", re: /\bin een trendy kleur\b/gi, to: "in een opvallende kleur" },
  { name: "trendy", re: /\bdeze trendy\b/gi, to: "deze" },
  { name: "pronkstuk", re: /\been waar pronkstuk\b/gi, to: "een blikvanger" },
  // u-vorm → je
  { name: "u-vorm", re: /\bhaalt u\b/g, to: "haal je" },
  { name: "u-vorm", re: /\bkunt u\b/g, to: "kun je" },
  { name: "u-vorm", re: /\bwilt u\b/g, to: "wil je" },
  { name: "u-vorm", re: /\bbent u\b/g, to: "ben je" },
  { name: "u-vorm", re: /\bheeft u\b/g, to: "heb je" },
  { name: "u-vorm", re: /\bu kunt\b/g, to: "je kunt" },
  { name: "u-vorm", re: /\buw\b/g, to: "je" },
  { name: "u-vorm", re: /\bUw\b/g, to: "Je" },
];

/** Restanten die een mens moet bekijken (na de automatische regels). */
const MANUAL: Array<{ re: RegExp; reason: string }> = [
  { re: /\buniek\w*/i, reason: "nog 'uniek' — herschrijven" },
  { re: /\bhoogwaardig\w*/i, reason: "nog 'hoogwaardig' — herschrijven" },
  { re: /\b(?<!Luxe )luxe\b(?! velvet)/i, reason: "nog 'luxe' — herschrijven" },
  { re: /\bstatement\w*/i, reason: "nog 'statement' — herschrijven" },
  { re: /\btrendy\b/i, reason: "nog 'trendy' — herschrijven" },
  { re: /\b(premium|de beste|must[- ]have|meesterwerk|ongeëvenaard\w*|stunning)\b/i, reason: "superlatief/claim — herschrijven" },
  // losse "u" als aanspreekvorm (niet U-poot, Ares U, U-vormig)
  { re: /(^|[\s,])u(?=[\s,.])(?!-)/, reason: "u-vorm — handmatig omzetten naar je" },
];

run(async () => {
  const products = await loadProducts();
  const changes: Change[] = [];
  const flags: Flag[] = [];
  for (const p of products) {
    const used = new Set<string>();
    let text = p.description;
    for (const r of RULES) {
      const next = replaceKeepCase(text, r.re, r.to);
      if (next !== text) used.add(r.name);
      text = next;
    }
    text = tidy(text);
    propose(changes, flags, p, "description", p.description, text, [...used]);
    for (const m of MANUAL) {
      const hit = text.match(new RegExp(`.{0,50}${m.re.source}.{0,50}`, m.re.flags.replace("g", "")));
      if (hit) flag(flags, p, "description", hit[0].trim(), m.reason);
    }
  }
  const report = writeReport(SCRIPT, changes, flags, { products: products.length, changes: changes.length, flags: flags.length });
  printSummary(SCRIPT, changes, flags, report);
  await applyChanges(SCRIPT, changes);
});
