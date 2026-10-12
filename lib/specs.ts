/**
 * Pure helpers voor productspecificaties (Product.specs is een JSON-string
 * sleutel → waarde). Geen Prisma, geen Next-runtime: bruikbaar in scripts,
 * Server Components en de Shopping-feed.
 *
 * - parseSpecs / normalizeSpecKeys: JSON → object met vaste sleutelvolgorde
 * - parseDimensions / formatDimensions: alle aangetroffen afmeting-notaties
 *   → één canoniek formaat ("B 120 × D 60 × H 45 cm", "Ø 120 × H 75 cm")
 * - dimensionContext: praktische context bij een maat (CLAUDE.md §3)
 * - COLOR_HEX / colorHexFor: kleurnaam → swatch-hex
 * - productTypeLabel / nameHasType: categorie → producttype in enkelvoud
 * - stripProductCode / findProductCode: leverancierscodes in namen
 */

export type Dimensions = {
  /** Breedte (of lengte bij tafels) in cm. */
  w?: number;
  /** Breedte in uitgeschoven stand (uitschuiftafels: "180/220"). */
  wMax?: number;
  /** Diepte in cm. */
  d?: number;
  /** Hoogte in cm. */
  h?: number;
  /** Diameter in cm (ronde bladen, lampen). */
  diameter?: number;
};

// ─── Specs-object ───────────────────────────────────────────────────

export function parseSpecs(json: string | null | undefined): Record<string, string> {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const key = k.trim();
      if (!key) continue;
      if (typeof v === "string" && v.trim()) out[key] = v.trim();
      else if (typeof v === "number") out[key] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** Vaste weergavevolgorde; onbekende sleutels komen vóór Artikelnummer/EAN. */
export const SPEC_KEY_ORDER: ReadonlyArray<string> = [
  "Serie",
  "Afmetingen",
  "Materiaal",
  "Kleur",
  "Afwerking",
  "Vorm",
  "Bladdikte",
  "Model",
  "Type",
  "Frame",
  "Stoffering",
  "Stofkleur",
  "Patroon",
  "Samenstelling",
  "Matras",
  "Opstelling",
  "Hoekmaat",
  "Zitcomfort",
  "Armleuning",
  "Onderhoud",
  "Exclusief",
  "Garantie",
];
const TRAILING_KEYS: ReadonlyArray<string> = ["Artikelnummer", "EAN"];

/** Sleutels die niet in specs horen (staan in een eigen kolom of zijn typefouten). */
const DROP_KEY = /^(categorie|category|levertijd|levertijdken|levering|leverdatum)$/i;

/** Alias → canonieke sleutel (case-insensitive). */
const KEY_ALIAS: Record<string, string> = {
  afmeting: "Afmetingen",
  afmetingen: "Afmetingen",
  maat: "Afmetingen",
  maten: "Afmetingen",
  "afmetingen (cm)": "Afmetingen",
  materialen: "Materiaal",
  materiaal: "Materiaal",
  materiaalsoort: "Materiaal",
  kleuren: "Kleur",
  kleur: "Kleur",
  "opsteling kiezen": "Opstelling",
  "opstelling kiezen": "Opstelling",
  opstelling: "Opstelling",
  artikelnr: "Artikelnummer",
  "art.nr.": "Artikelnummer",
  "art. nr.": "Artikelnummer",
  sku: "Artikelnummer",
  artikelnummer: "Artikelnummer",
  ean: "EAN",
  "ean-code": "EAN",
  eancode: "EAN",
  merk: "Merk",
};

function canonicalKey(raw: string): string | null {
  const key = raw.trim().replace(/\s+/g, " ");
  if (!key || DROP_KEY.test(key)) return null;
  const alias = KEY_ALIAS[key.toLowerCase()];
  if (alias) return alias;
  const known = [...SPEC_KEY_ORDER, ...TRAILING_KEYS].find((k) => k.toLowerCase() === key.toLowerCase());
  if (known) return known;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Typefouten en aliassen herstellen, kolom-dubbelingen (Categorie, Levertijd)
 * verwijderen en sleutels in vaste volgorde zetten. Waarden blijven ongemoeid.
 */
export function normalizeSpecKeys(specs: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(specs)) {
    const key = canonicalKey(rawKey);
    const value = typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "");
    if (!key || !value) continue;
    if (!(key in mapped)) mapped[key] = value; // eerste waarde wint bij dubbele sleutels
  }
  const ordered: Record<string, string> = {};
  for (const key of SPEC_KEY_ORDER) if (key in mapped) ordered[key] = mapped[key];
  for (const key of Object.keys(mapped)) {
    if (!SPEC_KEY_ORDER.includes(key) && !TRAILING_KEYS.includes(key)) ordered[key] = mapped[key];
  }
  for (const key of TRAILING_KEYS) if (key in mapped) ordered[key] = mapped[key];
  return ordered;
}

// ─── Afmetingen ─────────────────────────────────────────────────────

/** Categorieën waar een kale "B × H (× D)" gebruikelijk is (aan de wand). */
const VERTICAL_CATEGORIES = new Set(["spiegels", "wandlampen"]);

const MIN_CM = 1;
const MAX_CM = 800;

function num(s: string): number {
  return Number(s.replace(",", "."));
}

function plausible(n: number | undefined): boolean {
  return n === undefined || (Number.isFinite(n) && n >= MIN_CM && n <= MAX_CM);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Begrijpt o.a.: "B 120 × D 60 × H 45 cm", "B120×D60×H45", "120x60x45 cm",
 * "120 x 60 cm", "Ø 120 cm", "Ø 120 × H 75 cm", "L 200 B 100 H 76",
 * "180/220×90 cm" (uitschuiftafel), "250/230/57 cm", "80 × 140 × 3,7 cm".
 * Decimalen met punt of komma. Onbekend/ambigu (meerdere maten, enkel getal
 * zonder letter) → null. `category` bepaalt de lezing van kale getallen:
 * spiegels/wandlampen = B × H (× D), overig = B × D (× H).
 */
export function parseDimensions(text: string | null | undefined, category?: string): Dimensions | null {
  if (!text) return null;
  let s = text
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[×xX*]/g, "×")
    .replace(/[⌀∅ø]/g, "Ø")
    .replace(/cm/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  // Meerdere maten in één veld ("Matrasmaten: 140×200, 160×200") → geen eenduidige maat.
  if (/matrasmaten|,\s*\d+\s*×/i.test(s)) return null;

  // 1) Notaties met letters (B/D/H, L/B/H, Ø, voluit).
  const lettered: Dimensions = {};
  const re = /(?:^|[^A-Za-z])(Ø|diameter|diam|dia|breedte|breed|diepte|diep|hoogte|hoog|lengte|lang|width|depth|height|length|[BDHLW])\s*:?\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?/gi;
  let m: RegExpExecArray | null;
  let letteredHits = 0;
  while ((m = re.exec(s))) {
    const key = m[1].toLowerCase();
    const value = num(m[2]);
    const second = m[3] ? num(m[3]) : undefined;
    letteredHits++;
    if (key === "ø" || key.startsWith("dia")) lettered.diameter = value;
    else if (key === "l" || key.startsWith("len") || key.startsWith("lang")) {
      lettered.w = value;
      if (second !== undefined) lettered.wMax = second;
    } else if (key === "b" || key === "w" || key.startsWith("bree") || key === "width") {
      // "L 200 B 100": L is de lengte (B bij ons), B hier is de diepte.
      if (lettered.w !== undefined && !("d" in lettered)) lettered.d = value;
      else {
        lettered.w = value;
        if (second !== undefined) lettered.wMax = second;
      }
    } else if (key === "d" || key.startsWith("diep") || key === "depth") lettered.d = value;
    else if (key === "h" || key.startsWith("hoog") || key === "height") lettered.h = value;
  }
  if (letteredHits > 0) {
    const dims = finalize(lettered);
    return dims && Object.keys(dims).length > 0 ? dims : null;
  }

  // 2) Kale getallen: "120 × 60 × 45", "180/220 × 90", "250/230/57", "322 - 282".
  const numbers = s.match(/\d+(?:\.\d+)?/g)?.map(num) ?? [];
  if (numbers.length === 0 || numbers.length > 3) return null;
  const vertical = category !== undefined && VERTICAL_CATEGORIES.has(category);
  // Uitschuiftafel: "180/220 × 90" (precies één slash, gevolgd door ×).
  const range = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)(?:\s*×\s*(\d+(?:\.\d+)?))?$/);
  if (range) {
    return finalize({
      w: num(range[1]),
      wMax: num(range[2]),
      d: num(range[3]),
      h: range[4] ? num(range[4]) : undefined,
    });
  }
  // Alleen getallen gescheiden door ×, / of - (geen losse tekst met getallen).
  if (!/^\d+(?:\.\d+)?(?:\s*[×/-]\s*\d+(?:\.\d+)?){0,2}$/.test(s)) return null;
  if (numbers.length === 1) return null; // enkel getal zonder letter: onbekend welke maat
  if (numbers.length === 2) return finalize(vertical ? { w: numbers[0], h: numbers[1] } : { w: numbers[0], d: numbers[1] });
  return finalize(
    vertical ? { w: numbers[0], h: numbers[1], d: numbers[2] } : { w: numbers[0], d: numbers[1], h: numbers[2] },
  );
}

function finalize(dims: Dimensions): Dimensions | null {
  const out: Dimensions = {};
  if (dims.diameter !== undefined) out.diameter = round1(dims.diameter);
  if (dims.w !== undefined) out.w = round1(dims.w);
  if (dims.wMax !== undefined && dims.w !== undefined && dims.wMax > dims.w) out.wMax = round1(dims.wMax);
  if (dims.d !== undefined) out.d = round1(dims.d);
  if (dims.h !== undefined) out.h = round1(dims.h);
  if (![out.w, out.wMax, out.d, out.h, out.diameter].every(plausible)) return null;
  // Breedte minimaal 10 cm (vangt "3×30" = drie kappen van 30 cm af).
  if (out.w !== undefined && out.w < 10 && out.diameter === undefined) return null;
  return Object.keys(out).length > 0 ? out : null;
}

/** Hoogte-plafond per categorie; daarboven is de lezing van de getallen vrijwel zeker verkeerd. */
const MAX_HEIGHT_BY_CATEGORY: Record<string, number> = {
  banken: 120, hoekbanken: 120, bankstellen: 120, fauteuils: 130, poefs: 80,
  eettafels: 110, salontafels: 80, bijzettafels: 120, "tv-meubels": 240, eetkamerstoelen: 130,
  bedden: 180, matrassen: 60, dressoirs: 150, nachtkastjes: 100, ladekasten: 180, spiegels: 250,
};

/** Zijn de maten geloofwaardig voor deze categorie? (bv. een bank van 265 cm hoog is dat niet) */
export function plausibleDimensions(category: string, dims: Dimensions | null | undefined): boolean {
  if (!dims) return false;
  const maxH = MAX_HEIGHT_BY_CATEGORY[category];
  if (maxH !== undefined && dims.h !== undefined && dims.h > maxH) return false;
  return true;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

/** → "B 120 × D 60 × H 45 cm", "B 180/220 × D 90 cm", "Ø 120 × H 75 cm" of null. */
export function formatDimensions(dims: Dimensions | null | undefined): string | null {
  if (!dims) return null;
  const parts: string[] = [];
  if (dims.diameter !== undefined) parts.push(`Ø ${fmt(dims.diameter)}`);
  else if (dims.w !== undefined) parts.push(`B ${fmt(dims.w)}${dims.wMax !== undefined ? `/${fmt(dims.wMax)}` : ""}`);
  if (dims.d !== undefined) parts.push(`D ${fmt(dims.d)}`);
  if (dims.h !== undefined) parts.push(`H ${fmt(dims.h)}`);
  return parts.length > 0 ? `${parts.join(" × ")} cm` : null;
}

/** Is de tekst al in het canonieke formaat van formatDimensions? */
export function isCanonicalDimensions(text: string | null | undefined, category?: string): boolean {
  if (!text) return false;
  return formatDimensions(parseDimensions(text, category)) === text.trim();
}

const SOFA_CATEGORIES = new Set(["banken", "hoekbanken", "bankstellen"]);
const BED_CATEGORIES = new Set(["bedden", "matrassen"]);

/**
 * Praktische context bij een maat, voor de doelgroep van 35-55 (CLAUDE.md §3):
 * eettafels → aantal personen, banken → zitbreedte, bedden → matrasmaat.
 */
export function dimensionContext(category: string, dims: Dimensions | null | undefined): string | null {
  if (!dims) return null;
  if (category === "eettafels") {
    if (dims.diameter !== undefined) {
      if (dims.diameter >= 150) return "Ronde tafel met plaats voor 6 tot 8 personen";
      if (dims.diameter >= 120) return "Ronde tafel met plaats voor 4 tot 6 personen";
      if (dims.diameter >= 90) return "Ronde tafel met plaats voor 2 tot 4 personen";
      return null;
    }
    const seats = (w: number): string | null => {
      if (w >= 220) return "8 tot 10 personen";
      if (w >= 180) return "6 tot 8 personen";
      if (w >= 140) return "4 tot 6 personen";
      if (w >= 100) return "2 tot 4 personen";
      return null;
    };
    if (dims.w === undefined) return null;
    const base = seats(dims.w);
    if (!base) return null;
    const extended = dims.wMax !== undefined ? seats(dims.wMax) : null;
    return extended && extended !== base
      ? `Plaats voor ${base}, uitgeschoven ${extended}`
      : `Plaats voor ${base}`;
  }
  if (SOFA_CATEGORIES.has(category)) {
    if (dims.w === undefined) return null;
    const roomMeters = Math.ceil((dims.w + 100) / 50) / 2; // minimaal 1 m vrije ruimte, in halve meters
    return `Zitbreedte ${fmt(dims.w)} cm — past in een woonkamer vanaf ${fmt(roomMeters)} m breed`;
  }
  if (BED_CATEGORIES.has(category)) {
    if (dims.w === undefined || dims.d === undefined) return null;
    if (dims.w < 70 || dims.w > 220 || dims.d < 180 || dims.d > 230) return null;
    return `Matrasmaat ${fmt(dims.w)} × ${fmt(dims.d)} cm`;
  }
  return null;
}

// ─── Kleuren ────────────────────────────────────────────────────────

/** Kleurnaam (lowercase) → representatieve swatch. Zelfde basis als scripts/group-color-variants.ts. */
export const COLOR_HEX: Record<string, string> = {
  donkergrijs: "#4A4744", lichtgrijs: "#BDBBB6", donkerbruin: "#4A3527", lichtbruin: "#A47B53",
  donkerblauw: "#2A3B53", "gebroken wit": "#EFEDE6", "donkere eik": "#6B4F31", "eik naturel": "#C8A877",
  "mango hout": "#8A5A3B", antraciet: "#36353A", terracotta: "#B05C3B", travertin: "#C9B79C",
  naturel: "#C8A877", bordeaux: "#5B2A2E", mosterd: "#C99A2E", cognac: "#9A5B33", camel: "#B68A5B",
  taupe: "#9C8B78", ecru: "#E8E0CE", "crème": "#EFE7D6", creme: "#EFE7D6", beige: "#D8C7A8",
  zand: "#D2BE97", olijf: "#6B6E4A", oker: "#C9913B", grijs: "#8E8B85", bruin: "#6F4E37",
  zwart: "#1C1C1C", blauw: "#3E5C76", groen: "#5A6E54", rood: "#8E3B36", roze: "#D7A9AE",
  goud: "#C8A96A", zilver: "#BFC1C2", brons: "#7A5A3A", wit: "#F5F5F0", eik: "#B89B6E",
  walnoot: "#5A4632", cement: "#A8A39B", steen: "#B5B0A8", marmer: "#E6E3DE", decor: "#B0976E",
  sonoma: "#C9A876", crimson: "#8E3B36", goudbruin: "#8A6A3F",
  // LivingFurn-kleurcodes en Engelse namen uit importen.
  pecan: "#9B6B43", chestnut: "#7B4A2D", flintstone: "#8C8680", sandy: "#D8C9B0", sand: "#D8C9B0",
  charcoal: "#36353A", caramel: "#B5732F", champagne: "#E8D9B8", "goud-eiken": "#B8955A",
  "goud-wit": "#E2D3A8", "wit-goud": "#E2D3A8", espresso: "#4A3527", teak: "#A0714A",
  black: "#1C1C1C", white: "#F5F5F0", grey: "#8E8B85", gray: "#8E8B85", brown: "#6F4E37",
  cream: "#EFE7D6", gold: "#C8A96A", silver: "#BFC1C2", natural: "#C8A877", oak: "#B89B6E",
};

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Swatch-hex voor een kleurnaam; null als onbekend (geen gok). */
export function colorHexFor(colorName: string | null | undefined): string | null {
  if (!colorName) return null;
  const key = colorName.trim().toLowerCase();
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  const folded = fold(colorName);
  for (const [name, hex] of Object.entries(COLOR_HEX)) if (fold(name) === folded) return hex;
  // "Grijze eik" → eerste bekende woord; alleen bij één woordmatch.
  const words = folded.split(/[\s/,-]+/).filter(Boolean);
  const hits = words.map((w) => COLOR_HEX[w]).filter((h): h is string => Boolean(h));
  return hits.length === 1 ? hits[0] : null;
}

// ─── Materiaal uit tekst ────────────────────────────────────────────

const MATERIAL_WORDS: ReadonlyArray<[RegExp, string]> = [
  [/\b(eiken|eikenhout|eikenhouten|oak)\b/i, "Eikenhout"],
  [/\b(mangohout|mango ?hout|mangohouten|mango wood)\b/i, "Mangohout"],
  [/\b(teak|teakhout|teakhouten)\b/i, "Teakhout"],
  [/\b(acacia|acaciahout)\b/i, "Acaciahout"],
  [/\b(marmer|marmeren|marble)\b/i, "Marmer"],
  [/\b(travertin|travertijn|travertine)\b/i, "Travertin"],
  [/\b(glas|glazen|glass)\b/i, "Glas"],
  [/\b(metaal|metalen|metal)\b/i, "Metaal"],
  [/\b(staal|stalen|steel)\b/i, "Staal"],
  [/\b(velvet|fluweel|fluwelen|velours)\b/i, "Fluweel"],
  // \b kent geen "é", dus Unicode-letterklassen als woordgrens.
  [/(?<!\p{L})(bouclé|boucle)(?!\p{L})/iu, "Bouclé"],
  [/\b(leer|leder|leren|leather)\b/i, "Leer"],
  [/\b(stof|stoffen|fabric)\b/i, "Stof"],
  [/\b(rotan|rattan)\b/i, "Rotan"],
  [/\bmdf\b/i, "MDF"],
  [/\b(keramiek|keramisch|keramische|ceramic)\b/i, "Keramiek"],
];

/**
 * Materiaal afleiden uit tekst: alleen als precies één materiaal uit de
 * woordenlijst voorkomt. Meerdere of geen treffers → null.
 */
export function deriveMaterial(text: string | null | undefined): string | null {
  if (!text) return null;
  const hits = new Set<string>();
  for (const [re, label] of MATERIAL_WORDS) if (re.test(text)) hits.add(label);
  return hits.size === 1 ? [...hits][0] : null;
}

// ─── Producttype per categorie ──────────────────────────────────────

/** DB-categorie → producttype in enkelvoud + woorden waaraan je het type in een naam herkent. */
const PRODUCT_TYPE: Record<string, { label: string; synonyms: ReadonlyArray<string> }> = {
  banken: { label: "Bank", synonyms: ["bank", "sofa"] },
  hoekbanken: { label: "Hoekbank", synonyms: ["hoekbank", "bank", "sofa"] },
  bankstellen: { label: "Bankstel", synonyms: ["bankstel", "bank", "sofa", "zitgroep"] },
  fauteuils: { label: "Fauteuil", synonyms: ["fauteuil", "armstoel", "sofa", "stoel"] },
  poefs: { label: "Poef", synonyms: ["poef", "hocker", "zitbankje"] },
  tafels: { label: "Tafel", synonyms: ["tafel"] },
  eettafels: { label: "Eettafel", synonyms: ["eettafel", "tafel"] },
  salontafels: { label: "Salontafel", synonyms: ["salontafel", "tafel"] },
  bijzettafels: { label: "Bijzettafel", synonyms: ["bijzettafel", "wandtafel", "console", "sidetable", "tafel"] },
  "tv-meubels": { label: "TV-meubel", synonyms: ["tv-meubel", "tv meubel", "tv-kast", "tv kast", "tv-dressoir"] },
  stoelen: { label: "Stoel", synonyms: ["stoel"] },
  eetkamerstoelen: { label: "Eetkamerstoel", synonyms: ["eetkamerstoel", "stoel", "chair"] },
  bedden: { label: "Bed", synonyms: ["bed", "boxspring", "bedframe", "ledikant"] },
  matrassen: { label: "Matras", synonyms: ["matras"] },
  slaapkamers: { label: "Slaapkamer", synonyms: ["slaapkamer"] },
  jeugdkamers: { label: "Jeugdkamer", synonyms: ["jeugdkamer", "kinderkamer"] },
  kasten: { label: "Kast", synonyms: ["kast"] },
  kledingkasten: { label: "Kledingkast", synonyms: ["kledingkast", "kast"] },
  dressoirs: { label: "Dressoir", synonyms: ["dressoir", "kast"] },
  nachtkastjes: { label: "Nachtkastje", synonyms: ["nachtkast"] },
  ladekasten: { label: "Ladekast", synonyms: ["ladekast", "commode", "kast"] },
  kapstokken: { label: "Kapstok", synonyms: ["kapstok"] },
  schoenenkasten: { label: "Schoenenkast", synonyms: ["schoenenkast", "schoenenrek", "kast"] },
  verlichting: { label: "Lamp", synonyms: ["lamp"] },
  plafondlampen: { label: "Plafondlamp", synonyms: ["plafondlamp", "hanglamp", "lamp"] },
  vloerlampen: { label: "Vloerlamp", synonyms: ["vloerlamp", "lamp"] },
  tafellampen: { label: "Tafellamp", synonyms: ["tafellamp", "lamp"] },
  wandlampen: { label: "Wandlamp", synonyms: ["wandlamp", "lamp"] },
  spiegels: { label: "Spiegel", synonyms: ["spiegel"] },
};

/** "eetkamerstoelen" → "Eetkamerstoel"; onbekend → null. */
export function productTypeLabel(category: string): string | null {
  return PRODUCT_TYPE[category]?.label ?? null;
}

/** Staat het producttype (of een synoniem) al in de naam? */
export function nameHasType(category: string, name: string): boolean {
  const type = PRODUCT_TYPE[category];
  if (!type) return false;
  const n = fold(name);
  return type.synonyms.some((s) => new RegExp(`(^|[^a-z])${fold(s)}`, "i").test(n));
}

// ─── Leverancierscodes in namen ─────────────────────────────────────

/**
 * Codes zoals ZB-5635, QL10648, GH1018, ART1017, MT-97, CW003, FY2415,
 * DC-3369, MC-34150, 15564D2-E, 1-25131YD2-E, 056.
 */
const PRODUCT_CODE =
  /(?:^|[\s(])((?:[A-Z]{2,3}-?\d{2,6}[A-Z]?|(?:\d-)?\d{4,6}[A-Z]{1,2}\d?-[A-Z]|0\d{2}))(?=$|[\s)])/g;

export function findProductCode(name: string): string | null {
  const m = [...name.matchAll(PRODUCT_CODE)];
  return m.length > 0 ? m[0][1] : null;
}

/** Naam zonder leverancierscode(s), dubbele spaties opgeruimd. */
export function stripProductCode(name: string): string {
  return name
    .replace(PRODUCT_CODE, " ")
    // Lege haakjes én een losse haak die overblijft nadat de code (met zijn
    // openingshaak als scheidingsteken) is weggehaald: "Tafel )" → "Tafel".
    .replace(/\(\s*\)/g, " ")
    .replace(/(^|\s)[()](?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase slug zonder diakrieten (zelfde regels als de import-scripts). */
export function slugify(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
