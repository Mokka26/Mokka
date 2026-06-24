// Vult Materiaal + Kleur aan op Rousseau-producten (tafels/stoelen) uit de
// productnaam, zodat de kaarten hetzelfde spec-stramien tonen als andere
// bronnen. Vult alleen aan waar de spec ontbreekt (overschrijft niets).
//
// Dry-run: npx tsx scripts/backfill-rousseau-specs.ts
// Apply:   npx tsx scripts/backfill-rousseau-specs.ts --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Langere termen eerst (zodat "Mango hout" vóór "Hout" matcht, "Donkere eik" vóór "Eik").
const MATERIALS = [
  "Mango hout", "Massief hout", "Gerecycled hout", "Travertin", "Keramiek", "Sintered",
  "Marmer", "Marble", "Cement", "Beton", "Steen", "Glas", "Decor", "Rotan", "Bamboe",
  "Bouclé", "Boucle", "Velvet", "Fluweel", "Chenille", "Ribstof", "Teddy", "Microvezel",
  "Kunstleder", "Kunstleer", "Leder", "Leer", "Linnen", "Stof", "Metaal", "Chroom",
  "RVS", "Eik", "Walnoot", "Noten", "Acacia", "Hout", "MDF", "PU",
];
const COLORS = [
  "Donkergrijs", "Lichtgrijs", "Donkerbruin", "Lichtbruin", "Antraciet", "Donkere eik",
  "Naturel", "Gebroken wit", "Crème", "Creme", "Ecru", "Beige", "Taupe", "Camel", "Cognac",
  "Zand", "Oker", "Mosterd", "Bruin", "Zwart", "Wit", "Grijs", "Groen", "Blauw", "Rood",
  "Roze", "Goud", "Zilver", "Brons",
];

function findFirst(name: string, list: string[]): string | null {
  const n = name.toLowerCase();
  for (const term of list) if (n.includes(term.toLowerCase())) return term;
  return null;
}

async function main() {
  const cats = ["eettafels", "salontafels", "bijzettafels", "eetkamerstoelen"];
  const prods = await p.product.findMany({
    where: { source: "Rousseau", category: { in: cats }, deletedAt: null },
    select: { id: true, name: true, specs: true },
  });
  let matFilled = 0, colFilled = 0, both = 0, none = 0;
  const sample: string[] = [];
  for (const pr of prods) {
    let specs: Record<string, string> = {};
    try { specs = JSON.parse(pr.specs || "{}"); } catch {}
    let changed = false;
    if (!specs.Materiaal) { const m = findFirst(pr.name, MATERIALS); if (m) { specs.Materiaal = m; matFilled++; changed = true; } }
    if (!specs.Kleur) { const c = findFirst(pr.name, COLORS); if (c) { specs.Kleur = c; colFilled++; changed = true; } }
    if (changed) {
      both++;
      if (sample.length < 18) sample.push(`  ${pr.name.slice(0, 46).padEnd(46)} → ${specs.Materiaal ?? "—"} / ${specs.Kleur ?? "—"}`);
      if (APPLY) await p.product.update({ where: { id: pr.id }, data: { specs: JSON.stringify(specs) } });
    } else none++;
  }
  console.log(`\nRousseau tafels/stoelen: ${prods.length}`);
  console.log(`  Materiaal aangevuld: ${matFilled}`);
  console.log(`  Kleur aangevuld:     ${colFilled}`);
  console.log(`  producten gewijzigd: ${both} · niets te vullen: ${none}`);
  console.log(`\nVoorbeelden:\n${sample.join("\n")}`);
  console.log(APPLY ? "\n✅ Toegepast." : "\n(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
