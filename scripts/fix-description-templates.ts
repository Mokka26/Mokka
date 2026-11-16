// Verbeterplan 16 nov 2026 — CON-1: sjabloonbeschrijvingen die het verkeerde
// model, de verkeerde kleur of de verkeerde ruimte noemen.
//
//  1. model-placeholder: "De Ceiling plafondlamp", "Bekijk de Mirror spiegel",
//     "De Royal spiegel" bij een product dat geen Royal heet → "Deze
//     plafondlamp" / "Bekijk deze spiegel". Alleen als het woord niet in de
//     productnaam, de variantgroep of specs.Serie staat.
//  2. kleur: "in de kleur wit" terwijl colorName/naam een andere kleur noemt
//     (bv. Gold Line-spiegel) → kleur uit colorName.
//  3. ruimte: salon- en bijzettafels met eettafelzinnen ("het hart van je
//     eetkamer", "aanschuift voor het eten, werken of een spelletje") →
//     woonkamerzin. Copy-voorstel: eigenaar keurt goed.
//
// Raakt alleen Product.description. Levertijdzinnen ("snelle levering" e.d.)
// blijven letterlijk staan (vangrail in catalog-shared.ts).
//
// Dry-run: node --env-file=.env.local --import tsx scripts/fix-description-templates.ts
// Apply:   node --env-file=.env.local --import tsx scripts/fix-description-templates.ts --apply
import {
  applyChanges, flag, loadProducts, parseSpecs, printSummary, propose, replaceKeepCase, run, tidy, writeReport,
  type CatalogProduct, type Change, type Flag,
} from "./catalog-shared";

const SCRIPT = "fix-description-templates";

const NOUNS = [
  "plafondlamp", "hanglamp", "vloerlamp", "wandlamp", "tafellamp", "lamp", "spiegel",
  "eettafel", "salontafel", "bijzettafel", "wandtafel", "tafel", "eetkamerstoel", "stoel", "fauteuil",
  "bank", "hoekbank", "dressoir", "tv-meubel", "kast", "bed",
];
const MODEL_RE = new RegExp(`\\b([Dd])e ([A-Z][\\w-]+) (${NOUNS.join("|")})\\b`, "g");
/** Hoofdletterwoorden na "de" die geen model zijn (regelgeving e.d.). */
const NOT_A_MODEL = /^(EU|Europese|REACH|Livingfurn|Brix|New)$/;

const COLOURS = [
  "zwart", "wit", "grijs", "antraciet", "beige", "bruin", "goud", "zilver", "brons", "koper", "groen", "blauw",
  "rood", "roze", "geel", "oranje", "taupe", "creme", "ecru", "naturel", "zand", "cognac", "camel", "oker",
  "bordeaux", "walnoot", "eiken", "greige", "champagne", "messing", "chroom", "transparant", "terracotta",
];
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const coloursIn = (s: string) => COLOURS.filter((c) => new RegExp(`(^|[^a-z])${c}`).test(fold(s)));

/** Engelse importwoorden die als "model" in het sjabloon belandden (ook in Serie/variantgroep). */
const IMPORT_PLACEHOLDER = /^(Ceiling|Mirror|Table|Wall|Floor|Decoration|Pendant|Lamp)$/;

function fixModel(p: CatalogProduct, text: string, rules: Set<string>): string {
  const specs = parseSpecs(p.specs);
  const inName = fold(p.name);
  const known = fold([p.name, p.colorGroup ?? "", specs.Serie ?? "", specs.Model ?? ""].join(" "));
  return text.replace(MODEL_RE, (m: string, d: string, model: string, noun: string) => {
    if (NOT_A_MODEL.test(model)) return m;
    const isPlaceholder = IMPORT_PLACEHOLDER.test(model) && !new RegExp(`\\b${fold(model)}\\b`).test(inName);
    if (!isPlaceholder && known.includes(fold(model))) return m;
    rules.add("model-placeholder");
    return `${d}eze ${noun}`;
  });
}

function fixColour(p: CatalogProduct, text: string, rules: Set<string>, flags: Flag[]): string {
  if (!p.colorName) return text;
  const ref = `${p.colorName} ${p.name}`;
  const refColours = coloursIn(ref);
  if (refColours.length === 0) return text;
  return text.replace(/\bin de kleur ([a-zà-ÿ/\- ]+?)(?=[.,;]| en | met |$)/g, (m: string, said: string) => {
    const saidColours = coloursIn(said);
    if (saidColours.length === 0 || saidColours.every((c) => fold(ref).includes(c))) return m;
    // Alleen een eenduidige kleurnaam overnemen; anders handmatig.
    if (!/^[A-Za-zÀ-ÿ/ -]{2,40}$/.test(p.colorName ?? "")) {
      flag(flags, p, "description", m, `kleur in tekst (${said}) wijkt af van colorName (${p.colorName})`);
      return m;
    }
    rules.add("kleur");
    return `in de kleur ${(p.colorName ?? "").toLowerCase()}`;
  });
}

const LIVING_TABLES = new Set(["salontafels", "bijzettafels"]);

function fixRoom(p: CatalogProduct, text: string, rules: Set<string>): string {
  if (!LIVING_TABLES.has(p.category)) return text;
  let out = text.replace(
    /\been (salontafel|bijzettafel) waar je met gemak aanschuift voor het eten, werken of een spelletje/g,
    (_m: string, noun: string) => {
      rules.add("ruimte");
      return noun === "salontafel"
        ? "een salontafel waar je koffie, een boek of een plant kwijt kunt"
        : "een bijzettafel waar je koffie, een boek of een lamp kwijt kunt";
    },
  );
  out = replaceKeepCase(out, /\bhet hart van je eetkamer\b/g, "een vaste plek in je woonkamer");
  if (out.includes("een vaste plek in je woonkamer") && !text.includes("een vaste plek in je woonkamer")) rules.add("ruimte");
  return out;
}

run(async () => {
  const products = await loadProducts();
  const changes: Change[] = [];
  const flags: Flag[] = [];
  for (const p of products) {
    const rules = new Set<string>();
    let text = p.description;
    text = fixModel(p, text, rules);
    text = fixColour(p, text, rules, flags);
    text = fixRoom(p, text, rules);
    text = tidy(text);
    propose(changes, flags, p, "description", p.description, text, [...rules]);
  }
  const report = writeReport(SCRIPT, changes, flags, { products: products.length, changes: changes.length, flags: flags.length });
  printSummary(SCRIPT, changes, flags, report);
  await applyChanges(SCRIPT, changes);
});
