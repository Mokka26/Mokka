// Leesbare namen voor eetkamerstoelen: "Eetkamerstoel <Model> – <kleur> <materiaal>[, <onderstel>]".
// Leverancierscodes (stofcollecties als "Ote Montego 350", "ZB-5763") gaan uit de
// naam; de stofcode blijft bewaard in specs.Stof (handig bij stalen en nabestellen).
// De slug verandert NIET (URL's, canonicals en de feed blijven gelijk).
//
// Dry-run (schrijft een voorstel):  npx tsx --env-file=.env.local scripts/normalize-chair-names.ts <voorstel.json>
// Toepassen (maakt eerst back-up):  npx tsx --env-file=.env.local scripts/normalize-chair-names.ts <voorstel.json> --apply
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const OUT = process.argv.find((a, i) => i > 1 && !a.startsWith("--"));

type Row = { id: string; slug: string; name: string; source: string | null; colorName: string | null; specs: string };
type Result = { to: string; fabric?: string; assembled?: boolean; flag?: string };
type Proposal = Result & { id: string; slug: string; source: string | null; from: string };

const DASH = " – ";
const FABRIC_RE =
  /\bOte Jonah \d+ & Present \d+\b|\bJonah \d+ & Pres\. \d+\b|\b(?:Ote|Fabb|Davis|Lech|WZ|Miracle)\s+(?:[A-Za-z]+\s+)?(?:[A-Za-z]+)?[\s-]?[A-Z]*\d[\d-]*\b|\bPerfect Harmony\s+\d+\b/g;
const COLOR_FIX: Record<string, string> = { donckerpaars: "donkerpaars" };

const MATERIALS: [RegExp, string][] = [
  [/\bZitting PP kussen PU\b/i, "kunststof met kussen"],
  [/\bMicro fiber PU\b/i, "microvezel"],
  [/\bVintage PU\b/i, "vintage kunstleer"],
  // \b werkt niet na "é" (geen woordteken in JS-regex) → lookahead op letters.
  [/\bBouclé(?!\p{L})/iu, "bouclé"],
  [/\bFluweel\b/i, "fluweel"],
  [/\bCorduroy\b/i, "ribstof"],
  [/\bPU\b/, "kunstleer"],
  [/\bPP\b/, "kunststof"],
  [/\bStof\b/i, "stof"],
];
const WOODS: [RegExp, string][] = [
  [/\bGerookte Massieve Eik\b/i, "gerookt massief eiken"],
  [/\bMassieve Eik\b/i, "massief eiken"],
  [/\bGerookte Eik\b/i, "gerookt eiken"],
  [/\bEssenhout Naturel\b/i, "naturel essenhout"],
  [/\bEssenhout Walnoot\b/i, "walnoot essenhout"],
  [/\bNaturel Eik\b/i, "naturel eiken"],
  [/\bIepenhout\b/i, "iepenhout"],
];

const squash = (s: string) => s.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
const lower = (s: string) => squash(s).toLowerCase().split(" ").map((w) => COLOR_FIX[w] ?? w).join(" ");

function rousseau(name: string): Result | null {
  const m = name.match(/^(Set van (\d+) stoelen|Stoel met armleuningen|Stoel)\s+'([^']+)'\s*(.*)$/);
  if (!m) return null;
  const [, prefix, setCount, model, restRaw] = m;
  let rest = ` ${restRaw} `;
  const swivel = /Draaibaar tot 0/i.test(rest);
  const stack = /\bStapelbaar\b/i.test(rest);
  const assembled = /\bGemonteerd\b/i.test(rest);
  rest = rest.replace(/Draaibaar tot 0/gi, " ").replace(/\bStapelbaar\b/gi, " ").replace(/\bGemonteerd\b/gi, " ");

  const fabrics = rest.match(FABRIC_RE) ?? [];
  rest = rest.replace(FABRIC_RE, " ");

  // "<frame> - Stof …" of "… - Poot <kleur>"
  let frame = "";
  let legs = "";
  const legM = rest.match(/-\s*Poot\s+(\S+)/i);
  if (legM) { legs = legM[1]; rest = rest.replace(legM[0], " "); }
  const frameM = rest.match(/^\s*(Walnoot|Naturel|Zwart|Grijs|Eik)\s+-\s+/i) ?? rest.match(/^\s*(walnoot)\s+/);
  if (frameM) { frame = frameM[1]; rest = rest.replace(frameM[0], " "); }

  let wood = "";
  for (const [re, label] of WOODS) {
    if (re.test(rest)) { wood = label; rest = rest.replace(re, " "); break; }
  }

  // Filou: "Bouclé Grijs Rug PU Lichtgrijs" → zitting en rug apart
  let back = "";
  const backM = rest.match(/\bRug PU (\S+)/i);
  if (backM) { back = `rug ${backM[1].toLowerCase()} kunstleer`; rest = rest.replace(backM[0], " "); }

  let material = "";
  if (/\bmet gevlochten zitting\b/i.test(rest)) { material = "gevlochten zitting"; rest = rest.replace(/\bmet gevlochten zitting\b/i, " "); }
  for (const [re, label] of MATERIALS) {
    if (!material && re.test(rest)) { material = label; rest = rest.replace(re, " "); }
  }
  rest = rest.replace(/\bStof\b/gi, " ");
  if (!material && fabrics.length) material = "stof";

  // Losse streepjes weg, samengestelde kleuren ("Grijs-groen") houden.
  const color = lower(rest.replace(/&/g, " ").replace(/(^|\s)-+(?=\s|$)/g, " "));
  if (/[0-9]|\b(ote|fabb|davis|lech|wz|pres)\b/i.test(color)) return { to: name, flag: `rest niet herkend: "${color}"` };

  const type = setCount
    ? `Set van ${setCount} eetkamerstoelen`
    : `${swivel ? "Draaibare eetkamerstoel" : stack ? "Stapelbare eetkamerstoel" : "Eetkamerstoel"}${prefix.includes("armleuningen") ? " met armleuningen" : ""}`;
  const main = squash([color, material].filter(Boolean).join(" "));
  const extras = [back, wood ? `frame ${wood}` : "", frame ? `frame ${frame.toLowerCase()}` : "", legs ? `poten ${legs.toLowerCase()}` : ""].filter(Boolean);
  const descriptor = [main, ...extras].filter(Boolean).join(", ");
  if (!descriptor) return { to: name, flag: "geen kleur of materiaal gevonden" };
  return {
    to: `${type} ${model.replace(/\//g, " / ")}${DASH}${descriptor}`,
    fabric: fabrics.map(squash).join(" en ") || undefined,
    assembled: assembled || undefined,
  };
}

function greatHome(name: string): Result {
  let s = ` ${name} `.replace(/\bZB-\d+\b/g, " ").replace(/\bNew\b/g, " ").replace(/\b\d{4}\b/g, " ");
  const hasType = /\bEetkamerstoel\b/i.test(s);
  s = squash(s.replace(/\bEetkamerstoel\b/i, " "));
  const parts = s.split(" ");
  const twoWordModel = /^Turn$/i.test(parts[1] ?? "");
  const model = twoWordModel ? `${parts[0]} ${parts[1]}` : parts[0];
  let rest = parts.slice(twoWordModel ? 2 : 1).join(" ");
  // "Zilver onderstel Grijs" → "grijs, zilver onderstel"
  const under = rest.match(/^(\S+) onderstel (\S+)$/i);
  if (under) rest = `${under[2]}, ${under[1]} onderstel`;
  if (!hasType || !model) return { to: name, flag: "geen 'Eetkamerstoel' in de naam" };
  return { to: rest ? `Eetkamerstoel ${model}${DASH}${lower(rest)}` : `Eetkamerstoel ${model}` };
}

const DUTCH = new Set([
  "beige", "zand", "naturel", "taupe", "toffee", "karamel", "crème", "wit", "zwart", "grijs", "lichtgrijs",
  "donkergrijs", "bruin", "roest", "velours", "bouclé", "bordeaux", "eiken", "walnoot", "greige", "groen", "blauw",
  "roze", "goud", "cognac",
]);
const titleCase = (s: string) => s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** Kleur uit colorName; kleurnamen van de leverancier (Bisque Oasis, Turtle) blijven een eigennaam. */
function colorLabel(colorName: string): string {
  const c = lower(colorName).replace(/^(bouclé|velours|fluweel) (.+)$/, "$2 $1");
  return c.split(" ").some((w) => !DUTCH.has(w)) ? titleCase(c) : c;
}

function byColorName(name: string, colorName: string | null): Result {
  if (!colorName) return { to: name, flag: "geen colorName" };
  const words = squash(name.replace(/\bEetkamerstoel\b/i, " ")).split(" ");
  // LivingFurn: "<Model…> <kleur in het Engels>" → evenveel woorden van achteren weg als colorName telt.
  const colorWords = colorName.trim().split(/\s+/).length;
  const model = /Eetkamerstoel/i.test(name) ? words[0] : words.slice(0, Math.max(1, words.length - colorWords)).join(" ");
  return { to: `Eetkamerstoel ${model}${DASH}${colorLabel(colorName)}` };
}

function propose(r: Row): Proposal {
  const base = { id: r.id, slug: r.slug, source: r.source, from: r.name };
  if (r.name.includes(DASH)) return { ...base, to: r.name, flag: "al genormaliseerd" };
  if (r.source === "Rousseau") return { ...base, ...(rousseau(r.name) ?? { to: r.name, flag: "onbekend Rousseau-patroon" }) };
  if (r.source === "Great Home") return { ...base, ...greatHome(r.name) };
  return { ...base, ...byColorName(r.name, r.colorName) };
}

async function dryRun(out: string) {
  const rows: Row[] = await prisma.product.findMany({
    where: { deletedAt: null, category: "eetkamerstoelen" },
    select: { id: true, slug: true, name: true, source: true, colorName: true, specs: true },
    orderBy: { name: "asc" },
  });
  const proposals = rows.map(propose);
  writeFileSync(out, JSON.stringify(proposals, null, 2));
  const changes = proposals.filter((p) => !p.flag && p.to !== p.from);
  const flagged = proposals.filter((p) => p.flag && p.flag !== "al genormaliseerd");
  console.log(`${rows.length} stoelen · ${changes.length} nieuwe namen · ${flagged.length} handmatig`);
  for (const p of changes) console.log(`  ${p.from}\n→ ${p.to}${p.fabric ? `   [Stof: ${p.fabric}]` : ""}`);
  for (const p of flagged) console.log(`  ⚠ ${p.from} (${p.flag})`);
  console.log(`\nVoorstel: ${out}. Nakijken, dan opnieuw met --apply.`);
}

async function apply(out: string) {
  if (!existsSync(out)) throw new Error(`Voorstel ${out} bestaat niet; eerst een dry-run.`);
  const proposals: Proposal[] = JSON.parse(readFileSync(out, "utf8"));
  const todo = proposals.filter((p) => !p.flag && p.to !== p.from);
  const current = await prisma.product.findMany({
    where: { id: { in: todo.map((p) => p.id) } },
    select: { id: true, name: true, specs: true },
  });
  const byId = new Map(current.map((c) => [c.id, c]));
  const backup = `${out.replace(/\.json$/, "")}-backup.json`;
  writeFileSync(backup, JSON.stringify(current, null, 2));
  let done = 0;
  for (const p of todo) {
    const cur = byId.get(p.id);
    if (!cur || cur.name !== p.from) { console.log(`  ⏭ ${p.slug} (naam gewijzigd sinds het voorstel)`); continue; }
    let specs: Record<string, string> = {};
    try { specs = JSON.parse(cur.specs || "{}"); } catch { /* lege specs */ }
    if (p.fabric && !specs.Stof) specs.Stof = p.fabric;
    if (p.assembled && !specs.Montage) specs.Montage = "Wordt gemonteerd geleverd";
    await prisma.product.update({ where: { id: p.id }, data: { name: p.to, specs: JSON.stringify(specs) } });
    done++;
  }
  console.log(`✅ ${done} namen bijgewerkt. Back-up: ${backup}`);
}

async function main() {
  if (!OUT) throw new Error("Geef een pad voor het voorstel, bv. _sources/stoelnamen-2026-11-12.json");
  await (APPLY ? apply(OUT) : dryRun(OUT));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
