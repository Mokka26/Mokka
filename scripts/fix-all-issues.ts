/**
 * Comprehensive fix voor alle audit-issues:
 *   1. Regenereer namen voor app4sales producten met serie + model + finish + kleur
 *   2. Cleanup color groups waar zelfde kleur 2× voorkomt
 *   3. Voeg specs toe waar leeg
 *   4. Disambiguate duplicate namen (mirror models, daisy frames, etc.)
 *
 * DB-only updates — geen Cloudinary calls.
 */

import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
config({ path: ".env.local" });
const prisma = new PrismaClient();

interface RawProduct {
  code: string; name: string;
  price: number | null; originalPrice: number | null;
  imageUrl: string; inStock: boolean;
  catalogEdition: string;
  collectionName?: string;
}

const COLOR_NL: Record<string, string> = {
  BLACK: "Zwart", CREAM: "Crème", CREAME: "Crème",
  FLINTSTONE: "Flintstone", BROWN: "Bruin", WHITE: "Wit",
  OAK: "Eiken", GREY: "Grijs", GRAY: "Grijs",
  GOLD: "Goud", SILVER: "Zilver", TAUPE: "Taupe",
  BEIGE: "Beige", CHROOM: "Chroom", CHROME: "Chroom",
  CHAMPAGNE: "Champagne", "L.BROWN": "Lichtbruin",
  "DARK GREY": "Donkergrijs", "LIGHT BEIGE": "Lichtbeige",
};

const CAT_SUBTYPE: Record<string, string> = {
  eettafels: "Eettafel", salontafels: "Salontafel",
  bijzettafels: "Bijzettafel", "tv-meubels": "TV-meubel",
  kasten: "Dressoir", stoelen: "Eetkamerstoel",
  spiegels: "Spiegel", verlichting: "Lamp",
  tafels: "Tafel",
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function titleCase(s: string): string {
  return s.toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function detectColors(upper: string): { color: string; frame?: string } {
  // Eerst frame-kleur ("X LEGS")
  const frameMatch = upper.match(/\b(BLACK|SILVER|BROWN|GOLD|CHAMPAGNE|CHROOM|CHROME|WHITE)\s+LEGS/);
  const frame = frameMatch ? COLOR_NL[frameMatch[1]] : undefined;

  // Daarna stoffeer/finish-kleur (vaak laatste woord of na LEGS X)
  // Voor stoelen: kleur komt vaak na "LEGS Y" of als laatste UPPERCASE woord
  let color = "";
  for (const [en, nl] of Object.entries(COLOR_NL)) {
    if (upper.includes(en)) {
      // Skip als deze kleur al de frame is
      if (frame && nl === frame) continue;
      color = nl;
      break;
    }
  }
  return { color, frame };
}

function extractSeries(name: string, cat: string): { series: string; model?: string } {
  const parts = name.split(/\s+/);
  if (cat === "stoelen") {
    // "CHAIR NEW PAPATYA 5421 SILVER LEGS GREY"
    // serie = NEW PAPATYA, model = 5421
    // OR "CHAIR BARONI ZB-5686 GREY"
    // serie = BARONI, model = ZB-5686
    let i = parts[0].toUpperCase() === "CHAIR" ? 1 : 0;
    const seriesWords: string[] = [];
    while (i < parts.length) {
      const p = parts[i];
      if (/^[A-Z]+$/.test(p) && p !== "LEGS" && !COLOR_NL[p] && p.length > 1) {
        seriesWords.push(p);
        i++;
      } else break;
    }
    const series = titleCase(seriesWords.join(" "));
    // Model: eerste deel dat lijkt op model-code
    const modelMatch = name.match(/\b(ZB-\d+|MC-\d+|DC-\d+|\d{4,5}|GH\d+|GH-ART\d+|[A-Z]+-\d+)\b/);
    const model = modelMatch?.[1];
    return { series, model };
  }
  if (cat === "spiegels") {
    // "WALL DECORATION 1-25131YD2-E WITH LED 80X140X3.7"
    // model = "1-25131YD2-E" of "15558D-E"
    const modelMatch = name.match(/\b([\dA-Z-]+(?:YD\d|ND\d|D\d?|D)?-E)\b/);
    return { series: "Wandspiegel", model: modelMatch?.[1] };
  }
  // Default: serie = eerste woord (of "NEW ORGANIC" / "KIMBERLY BROWN" combos)
  const compoundSeries = ["NEW ORGANIC", "KIMBERLY BROWN", "KIMBERLY BLACK", "MONZA OAK", "MONZA BROWN", "ROYAL BLACK", "ROYAL BROWN", "ROYAL CREAM"];
  for (const c of compoundSeries) {
    if (name.toUpperCase().startsWith(c)) {
      return { series: titleCase(c) };
    }
  }
  return { series: titleCase(parts[0]) };
}

function extractSize(name: string): string {
  // "180X90X75", "200×40×50", "55 Ø", "180/200x90x75"
  const m = name.match(/(\d+(?:\/\d+)?(?:[xX×]\d+(?:[xX×]\d+)?))/);
  if (m) return m[1].replace(/x/gi, "×");
  const round = name.match(/(\d+)\s*Ø/i);
  if (round) return `Ø ${round[1]}`;
  return "";
}

function extractMaterials(upper: string): string[] {
  const out: string[] = [];
  if (/SINTER\s*STONE|SINTERED STONE/.test(upper)) out.push("Sinter Stone");
  if (/MARBLE\b|MARMER/.test(upper)) out.push("Marmer");
  if (/FAUX MARBLE/.test(upper)) out.push("Faux Marmer");
  if (/CERAMIC|KERAMIEK/.test(upper)) out.push("Keramiek");
  if (/VENEER/.test(upper)) out.push("Veneer");
  if (/VISGRAAT/.test(upper)) out.push("Visgraat");
  return out;
}

function buildName(p: RawProduct, category: string): string {
  const upper = p.name.toUpperCase();
  const subType = CAT_SUBTYPE[category] ?? "Product";
  const { series, model } = extractSeries(p.name, category);
  const size = extractSize(p.name);
  const { color, frame } = detectColors(upper);
  const materials = extractMaterials(upper);

  const tokens: string[] = [series];
  if (model) tokens.push(model);
  tokens.push(subType);
  if (size) tokens.push(size);
  if (frame) tokens.push(`${frame} frame`);
  if (color) tokens.push(color);
  if (materials.length) tokens.push(materials.join(" "));
  return tokens.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildSpecs(p: RawProduct, category: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const upper = p.name.toUpperCase();
  specs.Categorie = CAT_SUBTYPE[category] ?? "Product";
  const { series, model } = extractSeries(p.name, category);
  if (series) specs.Serie = series;
  if (model) specs.Model = model;
  const size = extractSize(p.name);
  if (size) specs.Afmetingen = size + " cm";
  const { color, frame } = detectColors(upper);
  if (color) specs.Kleur = color;
  if (frame) specs.Frame = frame;
  const mats = extractMaterials(upper);
  if (mats.length) specs.Materiaal = mats.join(", ");
  specs.Levertijd = "2-4 weken";
  return specs;
}

async function main() {
  // Laad app4sales JSON om bron-namen te vinden
  const rawData: RawProduct[] = JSON.parse(await readFile("scripts/app4sales-products.json", "utf8"));

  // Build slug → raw map (zelfde dedupe-logica als import)
  const seenSlugs = new Map<string, number>();
  const slugToRaw = new Map<string, RawProduct>();
  for (const p of rawData) {
    const base = slugify(p.name);
    const idx = seenSlugs.get(base) ?? 0;
    seenSlugs.set(base, idx + 1);
    const slug = idx === 0 ? base : `${base}-${idx}`;
    slugToRaw.set(slug, p);
  }

  console.log(`${slugToRaw.size} app4sales producten in raw JSON\n`);

  // STAP 1: Regenereer namen + specs voor app4sales producten
  console.log("=== STAP 1: Namen + specs regenereren ===");
  let renamed = 0, specsAdded = 0;
  for (const [slug, raw] of slugToRaw) {
    const db = await prisma.product.findUnique({ where: { slug } });
    if (!db) continue;
    const newName = buildName(raw, db.category);
    const newSpecs = JSON.stringify(buildSpecs(raw, db.category));
    const updates: { name?: string; specs?: string } = {};
    if (newName !== db.name && newName.length > 3) updates.name = newName;
    if (db.specs === "{}" || !db.specs) {
      updates.specs = newSpecs;
      specsAdded++;
    } else {
      // Update ook bestaande dunne specs als nieuw beter is
      try {
        const oldSpecs = JSON.parse(db.specs);
        if (Object.keys(oldSpecs).length < Object.keys(buildSpecs(raw, db.category)).length) {
          updates.specs = newSpecs;
          specsAdded++;
        }
      } catch { updates.specs = newSpecs; specsAdded++; }
    }
    if (Object.keys(updates).length > 0) {
      await prisma.product.update({ where: { id: db.id }, data: updates });
      if (updates.name) renamed++;
    }
  }
  console.log(`  ${renamed} namen gewijzigd, ${specsAdded} specs verbeterd\n`);

  // STAP 2: Cleanup color groups met duplicate kleuren
  console.log("=== STAP 2: Color groups dedupe ===");
  const all = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, colorGroup: true, colorName: true },
  });
  const cgMap = new Map<string, Array<{ id: string; slug: string; color: string | null }>>();
  for (const p of all) {
    if (!p.colorGroup) continue;
    const arr = cgMap.get(p.colorGroup) ?? [];
    arr.push({ id: p.id, slug: p.slug, color: p.colorName });
    cgMap.set(p.colorGroup, arr);
  }

  let ungrouped = 0;
  for (const [group, items] of cgMap) {
    const colors = items.map((i) => i.color);
    const uniqColors = new Set(colors);
    if (uniqColors.size === colors.length) continue; // perfect groep
    // Houd alleen 1 per kleur, rest ungroup
    const seenColor = new Set<string>();
    for (const item of items) {
      if (seenColor.has(item.color ?? "")) {
        // Dupe: verwijder uit groep
        await prisma.product.update({
          where: { id: item.id },
          data: { colorGroup: null, colorName: null, colorHex: null },
        });
        ungrouped++;
      } else {
        seenColor.add(item.color ?? "");
      }
    }
  }
  console.log(`  ${ungrouped} duplicates uit color groups gehaald\n`);

  // STAP 3: Re-run color grouping op nieuwe namen (om gemiste groepen op te pakken)
  console.log("=== STAP 3: Color grouping verfijnen ===");
  const refreshed = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, colorGroup: true, colorName: true },
  });
  const COLOR_LAST: Record<string, string> = {
    "zwart": "#1C1C1C", "wit": "#F5F5F0", "bruin": "#7A5A3F", "grijs": "#6E6E6E",
    "beige": "#D7C9AA", "crème": "#EFE6D2", "creme": "#EFE6D2", "goud": "#C9A961",
    "zilver": "#B8B8B8", "chroom": "#B8B8B8", "taupe": "#8B7E72",
    "flintstone": "#8C7A6B", "eiken": "#A57B47", "lichtbruin": "#8B7355",
    "donkergrijs": "#3D3D3D", "lichtbeige": "#E5D5B7", "champagne": "#D4B996",
  };

  // Groepeer op base-naam (alles vóór de kleur)
  const newGroups = new Map<string, Array<{ id: string; color: string; hex: string }>>();
  for (const p of refreshed) {
    const words = p.name.trim().split(/\s+/);
    if (words.length < 2) continue;
    // Pak achterste tot 3 woorden om kleur te detecteren (incl "frame")
    let colorIdx = -1;
    let colorKey = "";
    for (let i = words.length - 1; i >= Math.max(0, words.length - 4); i--) {
      const w = words[i].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (COLOR_LAST[w]) { colorIdx = i; colorKey = w; break; }
    }
    if (colorIdx === -1) continue;
    // Skip als "Frame" volgt op deze kleur (frame-kleur, niet stof)
    if (words[colorIdx + 1]?.toLowerCase() === "frame") continue;
    const base = words.filter((_, i) => i !== colorIdx).join(" ");
    const groupKey = slugify(base);
    if (!groupKey) continue;
    const hex = COLOR_LAST[colorKey];
    const arr = newGroups.get(groupKey) ?? [];
    arr.push({ id: p.id, color: words[colorIdx], hex });
    newGroups.set(groupKey, arr);
  }

  const valid = Array.from(newGroups.entries()).filter(([, items]) => {
    if (items.length < 2) return false;
    const colors = new Set(items.map((i) => i.color));
    return colors.size === items.length;
  });

  let regrouped = 0;
  for (const [group, items] of valid) {
    for (const it of items) {
      await prisma.product.update({
        where: { id: it.id },
        data: { colorGroup: group, colorName: it.color, colorHex: it.hex },
      });
      regrouped++;
    }
  }
  console.log(`  ${valid.length} clean color groups, ${regrouped} producten (re)gegroepeerd\n`);

  // Eindtelling
  const final = await prisma.product.findMany({
    select: { category: true, colorGroup: true },
  });
  const cats = new Map<string, number>();
  let withGroup = 0;
  for (const p of final) {
    cats.set(p.category, (cats.get(p.category) ?? 0) + 1);
    if (p.colorGroup) withGroup++;
  }
  console.log("=== EINDSTAND ===");
  for (const [c, n] of Array.from(cats.entries()).sort()) console.log(`  ${c.padEnd(15)} ${n}`);
  console.log(`\n${withGroup} producten in color groups`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
