// Hernoemt producten met een leverancierscode in naam of slug (Great Home en
// andere bronnen: ZB-5635, QL10648, GH1018, ART1017, MT-97, CW003, 15564D2-E …)
// naar "<Type> <Model> <kleur/uitvoering>" in het Nederlands, bv.
//   "Londen ZB-5635 Eetkamerstoel Crème"                   → "Eetkamerstoel Londen crème"
//   "Alenya ZB-5620 Eetkamerstoel Zwart onderstel Taupe"   → "Eetkamerstoel Alenya taupe, zwart onderstel"
//   "Plafondlamp Ø 45 Goud GH1106"                         → "Plafondlamp goud Ø 45 cm"
//   "Wandspiegel Spiegel 120×120 Goud" (mt-97-gold-line)   → "Spiegel met verlichting Gold Line 120 × 120 cm"
// Per hernoemd product: nieuwe Nederlandse slug (uniek; bij botsing suffix met
// de code), SlugRedirect-rij oude slug → product, code naar specs.Artikelnummer
// (als die ontbreekt) en de maat uit de naam naar specs.Afmetingen (als die ontbreekt).
// Cloudinary-URL's blijven ongewijzigd (public_id bevat de oude slug — dat is OK).
//
// Conservatief: alleen hernoemen als type én kleur eenduidig zijn en de nieuwe
// naam uniek is. De rest komt in een twijfellijst voor de eigenaar (admin).
// Voor ALLE kandidaten (ook twijfelgevallen) wordt wel specs.Artikelnummer
// gevuld met de code als dat veld leeg is.
// Verborgen producten blijven verborgen; prijs/voorraad/featured worden niet aangeraakt.
//
// Dry-run: npx tsx scripts/rename-greathome-products.ts
// Apply:   npx tsx scripts/rename-greathome-products.ts --apply
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import {
  findProductCode,
  formatDimensions,
  normalizeSpecKeys,
  parseDimensions,
  parseSpecs,
  productTypeLabel,
  slugify,
} from "../lib/specs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Kleurwoorden (NL en EN uit slugs) → Nederlandse naam in kleine letters.
const COLOR_NL: Record<string, string> = {
  zwart: "zwart", black: "zwart", wit: "wit", white: "wit", "crème": "crème", creme: "crème", cream: "crème",
  creame: "crème", beige: "beige", bruin: "bruin", brown: "bruin", lichtbruin: "lichtbruin", "l-brown": "lichtbruin",
  donkerbruin: "donkerbruin", grijs: "grijs", grey: "grijs", gray: "grijs", lichtgrijs: "lichtgrijs",
  "light-grey": "lichtgrijs", donkergrijs: "donkergrijs", "dark-grey": "donkergrijs", taupe: "taupe",
  champagne: "champagne", goud: "goud", gold: "goud", zilver: "zilver", silver: "zilver", groen: "groen",
  green: "groen", blauw: "blauw", blue: "blauw", roze: "roze", pink: "roze", rood: "rood", red: "rood",
  cognac: "cognac", zand: "zand", sand: "zand", caramel: "caramel", naturel: "naturel", natural: "naturel",
  antraciet: "antraciet", "goud-wit": "goud-wit", "wit-goud": "wit-goud", sepia: "sepia", koper: "koper",
  copper: "koper", brons: "brons", bronze: "brons", smoke: "rookglas", clear: "helder",
};
const colorNl = (word: string | undefined): string | null => (word ? COLOR_NL[word.toLowerCase()] ?? null : null);
const COLOR_EN_FOR_SLUG: Record<string, string> = {
  zwart: "black", wit: "white", "crème": "cream", bruin: "brown", lichtbruin: "l-brown", grijs: "grey",
  champagne: "champagne", beige: "beige", goud: "gold", zilver: "silver", taupe: "taupe", zand: "sand",
};

const LAMP_CATEGORIES = new Set(["plafondlampen", "vloerlampen", "tafellampen", "wandlampen"]);
const SLUG_CODE = /^(?:zb|ql|gh|art|mt|cw|fy|dc|mc|cd)-?[a-z]?\d{2,6}[a-z]?$|^(?:\d-)?\d{4,6}[a-z]{1,2}\d?-e$/;
const SLUG_NOISE = new Set([
  "mirror", "with", "light", "led", "wall", "decoration", "lamp", "ceiling", "floor", "table", "chair",
  "frame", "clear", "rechthoek", "the", "and", "en", "e",
]);

type Row = { id: string; slug: string; name: string; category: string; source: string | null; specs: string | null; hidden: boolean };
type Proposal = {
  row: Row;
  code: string | null;
  newName?: string;
  newSlug?: string;
  dims?: string;
  doubt?: string;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Code uit naam, anders uit de slug (hoofdletters). */
function codeOf(row: Row): string | null {
  const fromName = findProductCode(row.name);
  if (fromName) return fromName;
  const token = row.slug.split("-").find((t) => SLUG_CODE.test(t));
  if (token) return token.toUpperCase();
  // "mt-97" / "cw003" over twee slug-tokens
  const m = row.slug.match(/(?:^|-)(zb|ql|gh|art|mt|cw|dc|mc|cd)-(\d{2,6})(?:-|$)/);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
}

function proposeChair(row: Row, specs: Record<string, string>, code: string): Proposal {
  const m = row.name.match(/^(?<model>[A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+)?) (?<code>\S+) Eetkamerstoel\s*(?<rest>.*)$/);
  if (!m?.groups || m.groups.code !== code) return { row, code, doubt: "patroon niet herkend" };
  const model = m.groups.model.trim();
  const tokens = m.groups.rest.trim().split(/\s+/).filter(Boolean).map((t) => t.toLowerCase());
  const specColor = colorNl(specs.Kleur);
  const result = (fabric: string, legs?: string) => ({
    row, code, newName: legs ? `Eetkamerstoel ${model} ${fabric}, ${legs} onderstel` : `Eetkamerstoel ${model} ${fabric}`,
  });
  if (tokens.length === 0) return specColor ? result(specColor) : { row, code, doubt: "kleur ontbreekt (geen kleur in naam of specs)" };
  const c1 = colorNl(tokens[0]);
  if (!c1) return { row, code, doubt: `kleurwoord onbekend: "${tokens[0]}"` };
  if (tokens.length === 1) return result(c1);
  if (tokens.length === 3 && tokens[1] === "onderstel") {
    const c2 = colorNl(tokens[2]);
    return c2 ? result(c2, c1) : { row, code, doubt: `kleurwoord onbekend: "${tokens[2]}"` };
  }
  if (tokens.length === 2 && tokens[1] === "onderstel") {
    return specColor && specColor !== c1
      ? result(specColor, c1)
      : { row, code, doubt: "alleen onderstelkleur bekend; stofkleur ontbreekt" };
  }
  if (tokens.length === 2) {
    const c2 = colorNl(tokens[1]);
    if (!c2) return { row, code, doubt: `kleurwoord onbekend: "${tokens[1]}"` };
    const legsEn = COLOR_EN_FOR_SLUG[c1];
    if (legsEn && row.slug.includes(`${legsEn}-legs`)) return result(c2, c1);
    return { row, code, doubt: `twee kleuren zonder "onderstel" (${c1}, ${c2}); slug bevestigt onderstel niet` };
  }
  return { row, code, doubt: `uitvoering niet herkend: "${m.groups.rest}"` };
}

function proposeLamp(row: Row, specs: Record<string, string>, code: string): Proposal {
  const m = row.name.match(/^(?<type>Plafondlamp|Hanglamp|Vloerlamp|Tafellamp|Wandlamp)\s*(?<rest>.*)$/);
  if (!m?.groups) return { row, code, doubt: "patroon niet herkend" };
  const type = m.groups.type;
  // Code (als die in de naam staat) en maat eruit halen; wat overblijft moet één kleurwoord zijn.
  let rest = m.groups.rest.replace(code, " ").replace(/\s+/g, " ").trim();
  let sizeText: string | null = null;
  const circle = rest.match(/Ø\s*(\d+)/);
  const box = rest.match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)(?:\s*[×x]\s*(\d+(?:[.,]\d+)?))?/);
  if (circle) {
    sizeText = `Ø ${circle[1]}`;
    rest = rest.replace(circle[0], " ").trim();
  } else if (box) {
    sizeText = box[0];
    rest = rest.replace(box[0], " ").trim();
  }
  const dimsParsed = sizeText ? parseDimensions(sizeText, row.category) : null;
  if (sizeText && !dimsParsed) return { row, code, doubt: `uitvoering "${sizeText}" (aantal × maat?) niet eenduidig` };
  const words = rest.split(/\s+/).filter(Boolean);
  if (words.length > 1) return { row, code, doubt: `uitvoering niet herkend: "${rest}"` };
  const color = words.length === 1 ? colorNl(words[0]) : colorNl(specs.Kleur);
  if (words.length === 1 && !color) return { row, code, doubt: `kleurwoord onbekend: "${words[0]}"` };
  if (!color) return { row, code, doubt: "kleur ontbreekt (geen kleur in naam of specs)" };
  const sizeLabel = dimsParsed
    ? dimsParsed.diameter !== undefined
      ? ` Ø ${dimsParsed.diameter} cm`
      : ` ${[dimsParsed.w, dimsParsed.d, dimsParsed.h].filter((n) => n !== undefined).join(" × ")} cm`
    : "";
  const newName = `${type} ${color}${sizeLabel}`;
  const dims = dimsParsed ? formatDimensions(dimsParsed) ?? undefined : undefined;
  return { row, code, newName, dims };
}

const SHAPE_NL: Record<string, string> = { kare: "vierkant", square: "vierkant", oval: "ovaal", ovaal: "ovaal", round: "rond", rond: "rond" };

/** Slug zonder codes en maat-tokens, opgesplitst in woorden. */
function slugWords(slug: string): string[] {
  return slug
    .replace(/(?:^|-)(?:\d-)?\d{4,6}[a-z]{1,2}\d?-e(?=-|$)/g, "")
    .replace(/(?:^|-)(?:zb|ql|gh|art|mt|cw|dc|mc|cd)-?\d{2,6}(?=-|$)/g, "")
    .replace(/(?:^|-)[a-z]*\d+x\d+(?:x\d+)?(?=-|$)/g, "")
    .split("-")
    .filter((t) => t && !/^\d+$/.test(t));
}

function proposeMirror(row: Row, specs: Record<string, string>, code: string): Proposal {
  const m = row.name.match(/^(?:Wand)?[Ss]piegel\s+(?:\S+\s+)?(?:[Ss]piegel\s+)?(?<size>\d+\s*[×x]\s*\d+(?:\s*[×x]\s*\d+(?:[.,]\d+)?)?)\s*(?<color>[A-Za-zÀ-ÿ-]+)?(?:\s+\d{2,4})?$/);
  if (!m?.groups) return { row, code, doubt: "patroon niet herkend" };
  const light = /with-light|led|verlichting/.test(row.slug) || /verlichting|led/i.test(row.name);
  const colorFromName = colorNl(m.groups.color);
  if (m.groups.color && !colorFromName) return { row, code, doubt: `kleurwoord onbekend: "${m.groups.color}"` };
  const color = colorFromName ?? colorNl(specs.Kleur);
  const parsed = parseDimensions(m.groups.size, "spiegels");
  if (!parsed || parsed.w === undefined || parsed.h === undefined) return { row, code, doubt: `maat in naam onleesbaar: "${m.groups.size}"` };
  // Modelnaam = slug-woorden zonder ruis/kleur/vorm; een kleurwoord vóór een modelwoord hoort bij het model ("Gold Line").
  const words = slugWords(row.slug).filter((t) => !SLUG_NOISE.has(t));
  const modelTokens: string[] = [];
  let shape: string | null = null;
  for (let i = 0; i < words.length; i++) {
    const t = words[i];
    if (SHAPE_NL[t]) shape = SHAPE_NL[t];
    else if (t in COLOR_NL) {
      const next = words[i + 1];
      if (next && !(next in COLOR_NL) && !SHAPE_NL[next]) modelTokens.push(t);
    } else modelTokens.push(t);
  }
  const model = modelTokens.map(cap).join(" ");
  const colorInModel = color ? model.toLowerCase().includes(color) || model.toLowerCase().includes(COLOR_EN_FOR_SLUG[color] ?? "\u0000") : false;
  const size = `${parsed.w} × ${parsed.h} cm`;
  const newName = [light ? "Spiegel met verlichting" : "Spiegel", model || null, color && !colorInModel ? color : null, shape, size]
    .filter(Boolean)
    .join(" ");
  return { row, code, newName, dims: formatDimensions(parsed) ?? undefined };
}

function propose(row: Row): Proposal {
  const specs = parseSpecs(row.specs);
  const code = codeOf(row);
  if (!code) return { row, code: null, doubt: "geen code gevonden" };
  if (row.category === "eetkamerstoelen") return proposeChair(row, specs, code);
  if (LAMP_CATEGORIES.has(row.category)) return proposeLamp(row, specs, code);
  if (row.category === "spiegels") return proposeMirror(row, specs, code);
  const type = productTypeLabel(row.category) ?? row.category;
  return { row, code, doubt: `categorie ${row.category} (${type}): geen hernoemregel` };
}

async function main() {
  console.log(`\n═══ rename-greathome-products — ${APPLY ? "APPLY (live)" : "dry-run"} ═══`);
  const rows: Row[] = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true, category: true, source: true, specs: true, hidden: true },
  });
  const redirects = await prisma.slugRedirect.findMany({ select: { oldSlug: true } });
  const reservedSlugs = new Set<string>([...rows.map((r) => r.slug), ...redirects.map((r) => r.oldSlug)]);

  const candidates = rows.filter((r) => codeOf(r) !== null);
  const proposals = candidates.map(propose);

  // Uniciteit van namen: tegen alle huidige namen van andere producten én onderling.
  const currentNames = new Map<string, number>();
  for (const r of rows) currentNames.set(r.name.trim().toLowerCase(), (currentNames.get(r.name.trim().toLowerCase()) ?? 0) + 1);
  const proposedNames = new Map<string, number>();
  for (const p of proposals) if (p.newName) proposedNames.set(p.newName.toLowerCase(), (proposedNames.get(p.newName.toLowerCase()) ?? 0) + 1);
  for (const p of proposals) {
    if (!p.newName) continue;
    const key = p.newName.toLowerCase();
    const clashesCurrent = (currentNames.get(key) ?? 0) - (p.row.name.trim().toLowerCase() === key ? 1 : 0);
    if ((proposedNames.get(key) ?? 0) > 1 || clashesCurrent > 0) {
      p.doubt = `naam zou dubbel zijn: "${p.newName}" (modelnaam/afmeting nodig)`;
      delete p.newName;
    }
  }
  // Slugs: uniek; bij botsing suffix met de code.
  for (const p of proposals) {
    if (!p.newName) continue;
    let slug = slugify(p.newName);
    if (slug === p.row.slug) {
      p.newSlug = slug;
      continue;
    }
    if (reservedSlugs.has(slug)) slug = `${slug}-${slugify(p.code ?? "")}`;
    if (reservedSlugs.has(slug)) {
      p.doubt = `slug "${slug}" bestaat al`;
      delete p.newName;
      continue;
    }
    reservedSlugs.add(slug);
    p.newSlug = slug;
  }

  const renames = proposals.filter((p) => p.newName && p.newSlug);
  const doubts = proposals.filter((p) => !p.newName);
  // Artikelnummer aanvullen (alle kandidaten) en Afmetingen (alleen hernoemde met maat in naam).
  type SpecUpdate = { id: string; slug: string; specs: string; artikelnummer: boolean; afmetingen: boolean };
  const specUpdates: SpecUpdate[] = [];
  for (const p of proposals) {
    if (!p.code) continue;
    const specs = parseSpecs(p.row.specs);
    let changed = false;
    let artikelnummer = false;
    let afmetingen = false;
    if (!specs.Artikelnummer) {
      specs.Artikelnummer = p.code;
      changed = artikelnummer = true;
    }
    if (p.newName && p.dims && !specs.Afmetingen) {
      specs.Afmetingen = p.dims;
      changed = afmetingen = true;
    }
    if (changed) specUpdates.push({ id: p.row.id, slug: p.row.slug, specs: JSON.stringify(normalizeSpecKeys(specs)), artikelnummer, afmetingen });
  }

  console.log(`\nProducten: ${rows.length} · kandidaten met code: ${candidates.length} · te hernoemen: ${renames.length} · twijfel: ${doubts.length}`);
  console.log(`Artikelnummer aanvullen: ${specUpdates.filter((u) => u.artikelnummer).length} · Afmetingen uit naam: ${specUpdates.filter((u) => u.afmetingen).length}\n`);
  console.log("── Hernoemingen (oud → nieuw) ──");
  for (const p of renames) {
    console.log(`  ${p.row.hidden ? "[V] " : ""}${p.row.name}  →  ${p.newName}`);
    console.log(`      ${p.row.slug}  →  ${p.newSlug}${p.dims ? `   · Afmetingen: ${p.dims}` : ""}   · Artikelnummer: ${p.code}`);
  }
  console.log("\n── Twijfelgevallen (NIET aangepast) ──");
  const byReason = new Map<string, Proposal[]>();
  for (const p of doubts) {
    const reason = (p.doubt ?? "onbekend").replace(/"[^"]*"/g, "…");
    (byReason.get(reason) ?? byReason.set(reason, []).get(reason)!).push(p);
  }
  for (const [reason, list] of [...byReason.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${list.length}× ${reason}`);
    for (const p of list) console.log(`      · ${p.row.name}  [${p.row.slug}]  ${p.doubt}`);
  }

  if (!APPLY) {
    console.log("\n(DRY-RUN — run met --apply)");
    await prisma.$disconnect();
    return;
  }

  let renamed = 0;
  let specsUpdated = 0;
  const specById = new Map(specUpdates.map((u) => [u.id, u]));
  for (const p of renames) {
    const spec = specById.get(p.row.id);
    await prisma.$transaction([
      prisma.product.update({
        where: { id: p.row.id },
        data: { name: p.newName, slug: p.newSlug, ...(spec ? { specs: spec.specs } : {}) },
      }),
      ...(p.newSlug !== p.row.slug
        ? [prisma.slugRedirect.upsert({ where: { oldSlug: p.row.slug }, update: { productId: p.row.id }, create: { oldSlug: p.row.slug, productId: p.row.id } })]
        : []),
    ]);
    renamed++;
    if (spec) {
      specsUpdated++;
      specById.delete(p.row.id);
    }
  }
  for (const u of specById.values()) {
    await prisma.product.update({ where: { id: u.id }, data: { specs: u.specs } });
    specsUpdated++;
  }
  console.log(`\n✅ Toegepast: ${renamed} hernoemd (+ SlugRedirect), ${specsUpdated} producten met specs-aanvulling (Artikelnummer/Afmetingen).`);
  console.log("ISR ververst de pagina's binnen een uur (revalidate 3600).");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
