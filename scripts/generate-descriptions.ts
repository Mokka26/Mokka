// SEO-productbeschrijvingen-generator. Stelt per product een unieke, natuurlijke
// Nederlandse beschrijving samen uit de eigen data (naam, categorie, specs):
// categorie-specifieke opening + specs verweven + praktische context + afsluiting
// met trust-signalen. Variatie via een hash van de slug (deterministisch).
//
// Maakt eerst een back-up van de huidige beschrijvingen.
// Dry-run: npx tsx scripts/generate-descriptions.ts            (toont steekproef)
// Apply:   npx tsx scripts/generate-descriptions.ts --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BIZ = "Mokka Home";

type Specs = Record<string, string>;

// categorie → groep (bepaalt toon/opening)
const GROUP: Record<string, "zit" | "slaap" | "tafel" | "opberg" | "spiegel" | "licht"> = {
  hoekbanken: "zit", bankstellen: "zit", banken: "zit", fauteuils: "zit", poefs: "zit", eetkamerstoelen: "zit", stoelen: "zit",
  bedden: "slaap", slaapkamers: "slaap", jeugdkamers: "slaap", matrassen: "slaap",
  eettafels: "tafel", salontafels: "tafel", bijzettafels: "tafel", tafels: "tafel", "tafel-accessoires": "tafel", "tv-meubels": "opberg",
  kledingkasten: "opberg", dressoirs: "opberg", nachtkastjes: "opberg", ladekasten: "opberg", kasten: "opberg", schoenenkasten: "opberg", kapstokken: "opberg",
  spiegels: "spiegel",
  plafondlampen: "licht", vloerlampen: "licht", tafellampen: "licht", wandlampen: "licht", verlichting: "licht",
};
// nette enkelvoud-noun per categorie (fallback als specs.Categorie ontbreekt)
const NOUN: Record<string, string> = {
  hoekbanken: "hoekbank", bankstellen: "bankstel", banken: "bank", fauteuils: "fauteuil", poefs: "poef",
  eetkamerstoelen: "eetkamerstoel", stoelen: "stoel", bedden: "boxspring", slaapkamers: "slaapkamer",
  jeugdkamers: "jeugdkamer", matrassen: "matras", eettafels: "eettafel", salontafels: "salontafel",
  bijzettafels: "bijzettafel", tafels: "tafel", "tafel-accessoires": "tafelblad", "tv-meubels": "tv-meubel",
  kledingkasten: "kledingkast", dressoirs: "dressoir", nachtkastjes: "nachtkastje", ladekasten: "ladekast",
  kasten: "kast", schoenenkasten: "schoenenkast", kapstokken: "kapstok", spiegels: "spiegel",
  plafondlampen: "plafondlamp", vloerlampen: "vloerlamp", tafellampen: "tafellamp", wandlampen: "wandlamp", verlichting: "lamp",
};

const OPEN: Record<string, string[]> = {
  zit: [
    "De {name} nodigt uit om languit te ontspannen — een {noun} die het middelpunt van je woonkamer wordt.",
    "Met de {name} haal je zit-comfort én stijl in huis: een {noun} die zacht zit en er tijdloos uitziet.",
    "De {name} is een {noun} waar je met het hele gezin op wegzakt, zonder in te leveren op uitstraling.",
  ],
  slaap: [
    "De {name} zorgt voor rustige nachten in een slaapkamer die klopt — comfortabel, warm en tijdloos.",
    "Met de {name} maak je van je slaapkamer een plek om echt tot rust te komen.",
    "De {name} combineert comfort met een rustige, warme uitstraling voor de persoonlijkste ruimte van je huis.",
  ],
  tafel: [
    "De {name} brengt mensen samen — een {noun} waar je met gemak aanschuift voor het eten, werken of een spelletje.",
    "De {name} is een {noun} met karakter, gemaakt om jarenlang het hart van je eetkamer te zijn.",
    "Aan de {name} komt iedereen graag samen: een {noun} die functie en uitstraling moeiteloos combineert.",
  ],
  opberg: [
    "De {name} biedt volop opbergruimte zonder in te leveren op stijl — een {noun} die rust in je interieur brengt.",
    "Met de {name} houd je alles overzichtelijk opgeborgen; deze {noun} is net zo functioneel als mooi.",
    "De {name} is een {noun} die orde schept en tegelijk een warm accent aan je interieur toevoegt.",
  ],
  spiegel: [
    "De {name} maakt je ruimte optisch groter en lichter, en is tegelijk een decoratief statement aan de wand.",
    "Met de {name} haal je meer licht en diepte in huis — een spiegel die net zo goed als blikvanger werkt.",
  ],
  licht: [
    "De {name} geeft warm, sfeervol licht en is meteen een blikvanger in je interieur.",
    "Met de {name} bepaal je de sfeer in de kamer — functioneel licht met een stijlvolle vorm.",
    "De {name} zorgt voor de juiste sfeer op elk moment van de dag, met een vorm die opvalt.",
  ],
};

const CLOSE = [
  "Bestel de {name} eenvoudig online bij {biz} — inclusief btw en met 14 dagen bedenktijd.",
  "Bekijk de {name} bij {biz}: inclusief btw, snelle levering en veilig betalen.",
  "De {name} bestel je online bij {biz} — inclusief btw, met persoonlijk advies wanneer je dat wilt.",
];

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function pick(arr: string[] | undefined, seed: number): string {
  if (!arr || arr.length === 0) return "";
  const i = ((Math.trunc(seed) % arr.length) + arr.length) % arr.length; // altijd geldig, ook bij negatieve seed
  return arr[i];
}

// aantal zitplaatsen o.b.v. tafellengte (eerste maat)
function seatsFrom(afm: string): number | null {
  const m = afm.match(/(\d{2,3})/);
  if (!m) return null;
  const len = Number(m[1]);
  if (len < 120) return 4; if (len < 160) return 6; if (len < 200) return 8; if (len < 240) return 8; return 10;
}

function specSentence(cat: string, s: Specs): string {
  const mat = s.Materiaal || s.Stoffering ? (s.Materiaal ?? "") : "";
  const parts: string[] = [];
  const bekleding = s.Stoffering ? `met ${s.Stoffering}-stoffering` : "";
  const kleur = s.Kleur ? `in de kleur ${s.Kleur.toLowerCase()}` : "";
  if (mat) parts.push(`Uitgevoerd in ${mat.toLowerCase()}${kleur ? " " + kleur : ""}${bekleding ? " " + bekleding : ""}`);
  else if (s.Stoffering) parts.push(`Afgewerkt ${bekleding}${kleur ? " " + kleur : ""}`);
  else if (kleur) parts.push(`Uitgevoerd ${kleur}`);
  let sent = parts.join(" ");
  if (sent) sent += ".";
  // Afmetingen + praktische context
  if (s.Afmetingen) {
    const afm = s.Afmetingen;
    if (GROUP[cat] === "tafel" && cat.includes("eettafel")) {
      const seats = seatsFrom(afm);
      sent += ` Met een formaat van ${afm}${seats ? `, waar zo'n ${seats} personen comfortabel aanschuiven` : ""}.`;
    } else {
      sent += ` Afmetingen: ${afm}.`;
    }
  }
  return sent.trim();
}

function build(name: string, cat: string, specs: Specs): string {
  const group = GROUP[cat] ?? "opberg";
  // Curated (schone) noun eerst; specs.Categorie kan rommelig zijn (bv.
  // "Spiegel/wandaccessoire").
  const noun = (NOUN[cat] || specs.Categorie || "meubel").toLowerCase();
  // Toonbare naam: "{Serie} {noun}" (bv. "Rosso hoekbank") is korter en leest
  // natuurlijker dan de volledige DB-naam met maten/kleur erin. ALL-CAPS series
  // (MIRROR, JAPON) worden Title-cased.
  const serie = (specs.Serie || "").trim().replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase());
  const disp = serie && serie.length <= 24 && !serie.toLowerCase().includes(noun)
    ? `${serie} ${noun}`
    : name;
  const seed = hash(name + cat);
  const open = pick(OPEN[group] ?? OPEN.opberg, seed).replace(/{name}/g, disp).replace(/{noun}/g, noun);
  const spec = specSentence(cat, specs);
  const close = pick(CLOSE, seed >> 3).replace(/{name}/g, disp).replace(/{biz}/g, BIZ);
  return [open, spec, close].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

async function main() {
  const rows = await p.product.findMany({ where: { deletedAt: null }, select: { id: true, slug: true, name: true, category: true, specs: true, description: true } });
  console.log(`Producten: ${rows.length}\n`);

  if (APPLY) {
    const backup = rows.map((r) => ({ slug: r.slug, description: r.description }));
    const path = `C:/Users/konia/desc-backup-${Date.now()}.json`;
    writeFileSync(path, JSON.stringify(backup, null, 0));
    console.log(`Back-up huidige beschrijvingen: ${path}\n`);
  }

  let done = 0;
  const samples: string[] = [];
  for (const r of rows) {
    let s: Specs = {}; try { s = JSON.parse(r.specs || "{}"); } catch { /* */ }
    const desc = build(r.name, r.category, s);
    if (samples.length < 8 && ["hoekbanken", "bedden", "eettafels", "plafondlampen", "kledingkasten", "spiegels", "poefs", "eetkamerstoelen"].includes(r.category) && !samples.some((x) => x.startsWith("[" + r.category))) {
      samples.push(`[${r.category}] ${r.name}\n   ${desc}`);
    }
    if (APPLY) { await p.product.update({ where: { id: r.id }, data: { description: desc } }); done++; }
  }

  console.log("── Voorbeelden ──");
  console.log(samples.join("\n\n"));
  console.log(APPLY ? `\n✅ ${done} beschrijvingen bijgewerkt.` : "\n(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
