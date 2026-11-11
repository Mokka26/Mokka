/**
 * Filters voor de categoriepagina's — puur (geen Prisma/Next), dus testbaar en
 * bruikbaar in de Server Component.
 *
 * Werkwijze:
 * - Elke variant (product) krijgt genormaliseerde kenmerken: type, maat-groep,
 *   vorm, materiaalgroepen, kleurfamilies, prijs en voorraad.
 * - Een model (colorGroup) voldoet als minstens één variant aan álle actieve
 *   filters voldoet; die variant wordt de kaart (bv. filter "Zwart" → de zwarte
 *   uitvoering op de kaart).
 * - Tellingen per filterwaarde zijn "disjunctief": voor facet X tellen alle
 *   andere actieve filters mee, X zelf niet. Zo zie je hoeveel modellen je
 *   krijgt als je die waarde (erbij) aanklikt.
 * - De filterstaat staat in de URL (?vorm=rond&kleur=zwart,wit&prijs=500-1000),
 *   zodat terug-navigeren, delen en server-rendering gewoon werken.
 */
import { parseDimensions, parseSpecs } from "@/lib/specs";

// ─── Kenmerken per variant ──────────────────────────────────────────

export type MultiFacetKey = "type" | "maat" | "vorm" | "materiaal" | "kleur";
export const MULTI_FACET_KEYS: ReadonlyArray<MultiFacetKey> = ["type", "maat", "vorm", "materiaal", "kleur"];

export interface FilterableVariant {
  name: string;
  category: string;
  price: number;
  stock: number;
  colorName: string | null;
  sizeName: string | null;
  specs: string | null;
}

export interface VariantTraits {
  price: number;
  inStock: boolean;
  values: Record<MultiFacetKey, string[]>;
}

// ─── Materiaal ──────────────────────────────────────────────────────

interface Group {
  value: string;
  label: string;
  /** Woorden (zonder accenten, lowercase) waaraan je de groep herkent. */
  words: ReadonlyArray<string>;
}

/** Volgorde = volgorde in het filter. "Steen-look" vóór Marmer: "Faux marmer" is geen marmer. */
const MATERIAL_GROUPS: ReadonlyArray<Group & { primaryOnly?: boolean }> = [
  { value: "hout", label: "Hout", words: ["hout", "eik", "eiken", "eikenhout", "walnoot", "notenhout", "fineer", "teak", "teakhout", "acacia", "essen", "beuk", "sheesham", "oak", "wood"] },
  { value: "mangohout", label: "Mangohout", words: ["mango", "mangohout"] },
  { value: "steen-look", label: "Steen-look", words: ["decor", "faux", "look", "imitatie"] },
  { value: "marmer", label: "Marmer", words: ["marmer", "marble"] },
  { value: "keramiek-sintersteen", label: "Keramiek / sintersteen", words: ["keramiek", "keramisch", "sintersteen", "ceramic"] },
  { value: "steen", label: "Steen", words: ["steen", "natuursteen", "travertin", "travertijn", "terrazzo"] },
  { value: "glas", label: "Glas", words: ["glas", "glass"] },
  // Metaal alleen als het het hoofdmateriaal is (eerste in de lijst): "Mangohout, gecoat staal" = houten tafel.
  { value: "metaal", label: "Metaal", words: ["metaal", "staal", "ijzer", "aluminium", "chroom", "metal", "steel"], primaryOnly: true },
  { value: "stof", label: "Stof", words: ["stof", "chenille", "linnen", "fabric", "geweven"] },
  { value: "boucle", label: "Bouclé", words: ["boucle", "teddy"] },
  { value: "fluweel", label: "Fluweel", words: ["fluweel", "velvet", "velours"] },
  { value: "leer", label: "Leer en leerlook", words: ["leer", "leder", "kunstleer", "pu", "leather"] },
  { value: "rotan", label: "Rotan", words: ["rotan", "rattan", "riet"] },
];

/** Bij een deel met meerdere treffers wint de specifiekste (bv. "Bouclé-stof" → Bouclé, "Faux marmer" → Steen-look). */
const MATERIAL_PRIORITY = ["steen-look", "mangohout", "boucle", "fluweel", "leer", "keramiek-sintersteen"];

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function words(s: string): string[] {
  return fold(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** "Mangohout, Gecoat staal" → ["mangohout"]; "Faux Marmer" → ["steen-look"]; "Bouclé-stof" → ["boucle"]. */
export function materialGroups(materiaal: string | null | undefined): string[] {
  if (!materiaal) return [];
  const parts = materiaal.split(/[,;/+&]|\sen\s|\smet\s/i).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  parts.forEach((part, i) => {
    const w = words(part);
    // "Mango hout" → ook als één woord "mangohout" bekijken.
    const candidates = [...w, w.join("")];
    const hits = MATERIAL_GROUPS.filter(
      (g) => (!g.primaryOnly || i === 0) && g.words.some((x) => candidates.includes(x)),
    ).map((g) => g.value);
    if (hits.length === 0) return;
    const best = MATERIAL_PRIORITY.find((p) => hits.includes(p)) ?? hits[0];
    if (!out.includes(best)) out.push(best);
  });
  return out;
}

// ─── Kleur ──────────────────────────────────────────────────────────

interface ColorFamily extends Group {
  hex: string;
}

/** Kleurfamilies voor het filter; hex = bolletje in het filter (zelfde tinten als lib/specs COLOR_HEX). */
export const COLOR_FAMILIES: ReadonlyArray<ColorFamily> = [
  { value: "wit", label: "Wit", hex: "#F5F5F0", words: ["wit", "white", "ivoor", "ivory", "gebroken"] },
  { value: "creme", label: "Crème", hex: "#EFE7D6", words: ["creme", "cream", "ecru", "offwhite"] },
  { value: "beige", label: "Beige", hex: "#D8C7A8", words: ["beige", "zand", "sand", "sandy", "greige", "camel", "amandel", "bisque", "desert", "travertin", "linnen"] },
  { value: "taupe", label: "Taupe", hex: "#9C8B78", words: ["taupe", "mokka", "mocca"] },
  { value: "grijs", label: "Grijs", hex: "#8E8B85", words: ["grijs", "lichtgrijs", "donkergrijs", "antraciet", "flintstone", "basalt", "cement", "smoke", "peper", "zilver", "silver", "grey", "gray", "charcoal"] },
  { value: "zwart", label: "Zwart", hex: "#1C1C1C", words: ["zwart", "black"] },
  { value: "naturel", label: "Naturel hout", hex: "#C8A877", words: ["naturel", "natural", "eik", "eiken", "oak", "teak", "sonoma", "honey", "blank"] },
  { value: "bruin", label: "Bruin", hex: "#6F4E37", words: ["bruin", "lichtbruin", "donkerbruin", "brown", "walnoot", "walnut", "pecan", "chestnut", "espresso", "cognac", "karamel", "caramel", "toffee", "mango", "coffee", "hazel", "liver", "norris", "pandora", "goudbruin", "malta", "chocolade"] },
  { value: "groen", label: "Groen", hex: "#5A6E54", words: ["groen", "green", "olijf", "olive", "salie", "sage", "turtle", "mint"] },
  { value: "blauw", label: "Blauw", hex: "#3E5C76", words: ["blauw", "donkerblauw", "lichtblauw", "blue", "navy", "petrol"] },
  { value: "roze", label: "Roze", hex: "#D7A9AE", words: ["roze", "pink", "blossom", "salmon", "zalm", "oudroze"] },
  { value: "rood", label: "Rood", hex: "#8E3B36", words: ["rood", "red", "bordeaux", "burgundy", "crimson", "wijnrood"] },
  { value: "oranje", label: "Oranje en terra", hex: "#B05C3B", words: ["oranje", "orange", "terracotta", "roest", "brique", "amber"] },
  { value: "geel", label: "Geel", hex: "#D9B648", words: ["geel", "yellow", "mosterd", "oker"] },
  { value: "goud", label: "Goud", hex: "#C8A96A", words: ["goud", "gold", "messing", "brass", "champagne", "brons"] },
];

/** "Zwart, Bruin" → ["zwart", "bruin"]; "Donkergrijs" → ["grijs"]; onbekend → []. */
export function colorFamilies(text: string | null | undefined): string[] {
  if (!text) return [];
  const w = words(text);
  const out: string[] = [];
  for (const word of [...w, w.join("")]) {
    const fam = COLOR_FAMILIES.find((f) => f.words.includes(word));
    if (fam && !out.includes(fam.value)) out.push(fam.value);
  }
  return out;
}

// ─── Maat en vorm (tafels) ──────────────────────────────────────────

interface SizeBand {
  value: string;
  label: string;
  min: number;
  /** Exclusief; undefined = geen bovengrens. */
  max?: number;
}

const DINING_BANDS: ReadonlyArray<SizeBand> = [
  { value: "tot-160", label: "Tot 160 cm", min: 0, max: 160 },
  { value: "160-200", label: "160 tot 200 cm", min: 160, max: 200 },
  { value: "200-240", label: "200 tot 240 cm", min: 200, max: 240 },
  { value: "240-plus", label: "240 cm en langer", min: 240 },
];

const COFFEE_BANDS: ReadonlyArray<SizeBand> = [
  { value: "tot-80", label: "Tot 80 cm", min: 0, max: 80 },
  { value: "80-110", label: "80 tot 110 cm", min: 80, max: 110 },
  { value: "110-130", label: "110 tot 130 cm", min: 110, max: 130 },
  { value: "130-plus", label: "130 cm en langer", min: 130 },
];

/** Categorieën met een maatfilter (lengte of doorsnede van het blad). */
const SIZE_BANDS: Record<string, ReadonlyArray<SizeBand>> = {
  eettafels: DINING_BANDS,
  salontafels: COFFEE_BANDS,
};
const ALL_BANDS: ReadonlyArray<SizeBand> = [...DINING_BANDS, ...COFFEE_BANDS];

const TABLE_CATEGORIES = new Set(["tafels", "eettafels", "salontafels", "bijzettafels"]);

export const SHAPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "rechthoek", label: "Rechthoekig" },
  { value: "ovaal", label: "Ovaal" },
  { value: "rond", label: "Rond" },
  { value: "vierkant", label: "Vierkant" },
  { value: "organisch", label: "Organisch" },
];

type Dims = ReturnType<typeof parseDimensions>;

function tableShape(name: string, specs: Record<string, string>, dims: Dims): string | null {
  const vorm = fold(specs.Vorm ?? "");
  const n = fold(name);
  if (/ovaal|oval/.test(vorm) || /ovaal|oval/.test(n)) return "ovaal";
  if (/organ/.test(vorm) || /organisch|organic/.test(n)) return "organisch";
  if (/vierkant|square/.test(vorm)) return "vierkant";
  if (/rond|round/.test(vorm)) return "rond";
  if (/rechthoek|rectang/.test(vorm)) return dims?.w !== undefined && dims.w === dims.d ? "vierkant" : "rechthoek";
  if (!dims) return null;
  if (dims.diameter !== undefined) return "rond";
  if (dims.w !== undefined && dims.d !== undefined) return dims.w === dims.d ? "vierkant" : "rechthoek";
  return null;
}

/** Lengte van het blad: Ø of breedte; anders uit de maat-variant ("200 cm"). */
function tableLength(sizeName: string | null, dims: Dims): number | null {
  if (dims?.diameter !== undefined) return dims.diameter;
  if (dims?.w !== undefined) return dims.w;
  const m = sizeName?.match(/(\d{2,3})/);
  return m ? Number(m[1]) : null;
}

export function variantTraits(v: FilterableVariant): VariantTraits {
  const specs = parseSpecs(v.specs);
  const values: Record<MultiFacetKey, string[]> = { type: [v.category], maat: [], vorm: [], materiaal: [], kleur: [] };

  values.materiaal = materialGroups(specs.Materiaal ?? specs.materiaal);
  // Kleur van de variant zelf eerst (colorName), anders de specs.
  values.kleur = colorFamilies(v.colorName);
  if (values.kleur.length === 0) values.kleur = colorFamilies(specs.Kleur ?? specs.kleur);

  if (TABLE_CATEGORIES.has(v.category)) {
    const dims = parseDimensions(specs.Afmetingen ?? specs.afmetingen, v.category);
    const shape = tableShape(v.name, specs, dims);
    if (shape) values.vorm = [shape];
    const bands = SIZE_BANDS[v.category];
    const len = tableLength(v.sizeName, dims);
    if (bands && len !== null) {
      const band = bands.find((b) => len >= b.min && (b.max === undefined || len < b.max));
      if (band) values.maat = [band.value];
    }
  }
  return { price: v.price, inStock: v.stock > 0, values };
}

// ─── Filterstaat in de URL ──────────────────────────────────────────

export type SortKey = "aanbevolen" | "prijs-oplopend" | "prijs-aflopend" | "naam";
export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "aanbevolen", label: "Aanbevolen" },
  { value: "prijs-oplopend", label: "Prijs: laag naar hoog" },
  { value: "prijs-aflopend", label: "Prijs: hoog naar laag" },
  { value: "naam", label: "Naam: A tot Z" },
];

export interface PriceRange {
  min: number;
  /** undefined = geen bovengrens. */
  max?: number;
}

export interface ActiveFilters {
  multi: Record<MultiFacetKey, string[]>;
  prijs: PriceRange | null;
  voorraad: boolean;
  sort: SortKey;
}

export const PRICE_BUCKETS: ReadonlyArray<{ value: string; label: string; range: PriceRange }> = [
  { value: "0-250", label: "Tot € 250", range: { min: 0, max: 250 } },
  { value: "250-500", label: "€ 250 tot € 500", range: { min: 250, max: 500 } },
  { value: "500-1000", label: "€ 500 tot € 1.000", range: { min: 500, max: 1000 } },
  { value: "1000-2000", label: "€ 1.000 tot € 2.000", range: { min: 1000, max: 2000 } },
  { value: "2000-", label: "€ 2.000 en meer", range: { min: 2000 } },
];

type RawParams = Record<string, string | string[] | undefined>;

function first(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

const VALUE_RE = /^[a-z0-9-]{1,40}$/;

/** "500-1000" → {min:500,max:1000}; "2000-" → {min:2000}; ongeldig → null. */
export function parsePrice(raw: string | undefined): PriceRange | null {
  const m = raw?.match(/^(\d{1,6})-(\d{1,6})?$/);
  if (!m) return null;
  const a = Number(m[1]);
  if (m[2] === undefined) return a > 0 ? { min: a } : null;
  const b = Number(m[2]);
  if (a === 0 && b === 0) return null;
  return a <= b ? { min: a, max: b } : { min: b, max: a };
}

export function formatPriceParam(p: PriceRange): string {
  return `${p.min}-${p.max ?? ""}`;
}

export function parseFilters(params: RawParams): ActiveFilters {
  const multi = {} as Record<MultiFacetKey, string[]>;
  for (const key of MULTI_FACET_KEYS) {
    const raw = first(params[key]);
    multi[key] = raw
      ? [...new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => VALUE_RE.test(s)))].slice(0, 20)
      : [];
  }
  const sortRaw = first(params.sorteer);
  const sort = SORT_OPTIONS.find((o) => o.value === sortRaw)?.value ?? "aanbevolen";
  return { multi, prijs: parsePrice(first(params.prijs)), voorraad: first(params.voorraad) === "1", sort };
}

export function hasActiveFilters(f: ActiveFilters): boolean {
  return f.prijs !== null || f.voorraad || MULTI_FACET_KEYS.some((k) => f.multi[k].length > 0);
}

export function activeFilterCount(f: ActiveFilters): number {
  return (f.prijs ? 1 : 0) + (f.voorraad ? 1 : 0) + MULTI_FACET_KEYS.reduce((n, k) => n + f.multi[k].length, 0);
}

/** Querystring (zonder "?") in vaste volgorde, zonder lege waarden en zonder pagina. */
export function filtersToQuery(f: ActiveFilters): string {
  const q = new URLSearchParams();
  for (const key of MULTI_FACET_KEYS) if (f.multi[key].length > 0) q.set(key, [...f.multi[key]].sort().join(","));
  if (f.prijs) q.set("prijs", formatPriceParam(f.prijs));
  if (f.voorraad) q.set("voorraad", "1");
  if (f.sort !== "aanbevolen") q.set("sorteer", f.sort);
  // Komma's leesbaar houden in de URL.
  return q.toString().replace(/%2C/gi, ",");
}

export function emptyFilters(sort: SortKey = "aanbevolen"): ActiveFilters {
  return { multi: { type: [], maat: [], vorm: [], materiaal: [], kleur: [] }, prijs: null, voorraad: false, sort };
}

// ─── Filteren + tellen ──────────────────────────────────────────────

type SkipKey = MultiFacetKey | "prijs" | "voorraad";

function inPrice(price: number, p: PriceRange): boolean {
  return price >= p.min && (p.max === undefined || price <= p.max);
}

function matches(t: VariantTraits, f: ActiveFilters, skip?: SkipKey): boolean {
  if (skip !== "prijs" && f.prijs && !inPrice(t.price, f.prijs)) return false;
  if (skip !== "voorraad" && f.voorraad && !t.inStock) return false;
  for (const key of MULTI_FACET_KEYS) {
    if (key === skip) continue;
    const want = f.multi[key];
    if (want.length > 0 && !t.values[key].some((v) => want.includes(v))) return false;
  }
  return true;
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  selected: boolean;
  hex?: string;
}

export interface Facet {
  key: MultiFacetKey;
  label: string;
  options: FacetOption[];
}

export interface FilterResult<V> {
  /** Per gevonden model de variant die de kaart wordt, in de volgorde van `models`. */
  models: V[];
  facets: Facet[];
  priceOptions: FacetOption[];
  inStockCount: number;
}

const FACET_LABEL: Record<MultiFacetKey, string> = {
  type: "Soort",
  maat: "Maat",
  vorm: "Vorm",
  materiaal: "Materiaal",
  kleur: "Kleur",
};

function optionMeta(
  key: MultiFacetKey,
  value: string,
  typeLabel: (c: string) => string,
): { label: string; order: number; hex?: string } {
  const pick = <T extends { value: string }>(list: ReadonlyArray<T>): { item?: T; order: number } => {
    const i = list.findIndex((x) => x.value === value);
    return i >= 0 ? { item: list[i], order: i } : { order: 999 };
  };
  if (key === "type") return { label: typeLabel(value), order: 0 };
  if (key === "vorm") {
    const { item, order } = pick(SHAPES);
    return { label: item?.label ?? value, order };
  }
  if (key === "materiaal") {
    const { item, order } = pick(MATERIAL_GROUPS);
    return { label: item?.label ?? value, order };
  }
  if (key === "kleur") {
    const { item, order } = pick(COLOR_FAMILIES);
    return { label: item?.label ?? value, order, hex: item?.hex };
  }
  const { item, order } = pick(ALL_BANDS);
  return { label: item?.label ?? value, order };
}

/**
 * Filtert modellen en telt per filterwaarde.
 * `models`: per model de varianten in voorkeursvolgorde (eerste = standaardkaart).
 */
export function filterModels<V>(
  models: ReadonlyArray<ReadonlyArray<V>>,
  traitsOf: (v: V) => VariantTraits,
  f: ActiveFilters,
  typeLabel: (category: string) => string = (c) => c,
): FilterResult<V> {
  const picked: V[] = [];
  const counts: Record<MultiFacetKey, Map<string, number>> = {
    type: new Map(),
    maat: new Map(),
    vorm: new Map(),
    materiaal: new Map(),
    kleur: new Map(),
  };
  const priceCounts = new Map<string, number>();
  let inStockCount = 0;

  for (const variants of models) {
    const traits = variants.map(traitsOf);
    // Kaart: eerste passende variant op voorraad, anders de eerste passende.
    let card = -1;
    traits.forEach((t, i) => {
      if (!matches(t, f)) return;
      if (card === -1 || (t.inStock && !traits[card].inStock)) card = i;
    });
    if (card >= 0) picked.push(variants[card]);

    for (const key of MULTI_FACET_KEYS) {
      const seen = new Set<string>();
      for (const t of traits) if (matches(t, f, key)) for (const v of t.values[key]) seen.add(v);
      for (const v of seen) counts[key].set(v, (counts[key].get(v) ?? 0) + 1);
    }
    for (const b of PRICE_BUCKETS) {
      if (traits.some((t) => matches(t, f, "prijs") && inPrice(t.price, b.range))) {
        priceCounts.set(b.value, (priceCounts.get(b.value) ?? 0) + 1);
      }
    }
    if (traits.some((t) => t.inStock && matches(t, f, "voorraad"))) inStockCount++;
  }

  const facets: Facet[] = MULTI_FACET_KEYS.map((key) => {
    const selected = f.multi[key];
    const values = new Set([...counts[key].keys(), ...selected]);
    const options = [...values]
      .map((value) => {
        const meta = optionMeta(key, value, typeLabel);
        return {
          value,
          label: meta.label,
          hex: meta.hex,
          order: meta.order,
          count: counts[key].get(value) ?? 0,
          selected: selected.includes(value),
        };
      })
      .filter((o) => o.count > 0 || o.selected)
      .sort(
        (a, b) =>
          (key === "type" || key === "kleur" ? b.count - a.count : a.order - b.order) ||
          a.label.localeCompare(b.label, "nl"),
      )
      .map((o) => ({ value: o.value, label: o.label, hex: o.hex, count: o.count, selected: o.selected }));
    return { key, label: FACET_LABEL[key], options };
  }).filter((facet) => facet.options.length > 1 || facet.options.some((o) => o.selected));

  const selectedPrice = f.prijs ? formatPriceParam(f.prijs) : null;
  // Lege prijsklassen weglaten (tenzij gekozen): een knop die niets oplevert helpt niemand.
  const priceOptions: FacetOption[] = PRICE_BUCKETS.map((b) => ({
    value: b.value,
    label: b.label,
    count: priceCounts.get(b.value) ?? 0,
    selected: b.value === selectedPrice,
  })).filter((o) => o.count > 0 || o.selected);

  return { models: picked, facets, priceOptions, inStockCount };
}

const eur = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;

export function priceLabel(p: PriceRange): string {
  const bucket = PRICE_BUCKETS.find((b) => b.range.min === p.min && b.range.max === p.max);
  if (bucket) return bucket.label;
  if (p.max === undefined) return `Vanaf ${eur(p.min)}`;
  if (p.min <= 0) return `Tot ${eur(p.max)}`;
  return `${eur(p.min)} tot ${eur(p.max)}`;
}

/** Actieve filters als chips (label + filterstaat zonder dat filter). */
export function activeChips(
  f: ActiveFilters,
  facets: ReadonlyArray<Facet>,
): Array<{ key: string; label: string; without: ActiveFilters }> {
  const chips: Array<{ key: string; label: string; without: ActiveFilters }> = [];
  for (const key of MULTI_FACET_KEYS) {
    for (const value of f.multi[key]) {
      const label = facets.find((x) => x.key === key)?.options.find((o) => o.value === value)?.label ?? value;
      chips.push({
        key: `${key}:${value}`,
        label,
        without: { ...f, multi: { ...f.multi, [key]: f.multi[key].filter((v) => v !== value) } },
      });
    }
  }
  if (f.prijs) chips.push({ key: "prijs", label: priceLabel(f.prijs), without: { ...f, prijs: null } });
  if (f.voorraad) chips.push({ key: "voorraad", label: "Op voorraad", without: { ...f, voorraad: false } });
  return chips;
}

export function sortModels<V extends { price: number; name: string }>(list: V[], sort: SortKey): V[] {
  if (sort === "prijs-oplopend") return [...list].sort((a, b) => a.price - b.price);
  if (sort === "prijs-aflopend") return [...list].sort((a, b) => b.price - a.price);
  if (sort === "naam") return [...list].sort((a, b) => a.name.localeCompare(b.name, "nl"));
  return list;
}
