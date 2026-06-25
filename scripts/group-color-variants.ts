// Groepeert producten die hetzelfde model zijn in verschillende kleuren →
// colorGroup + colorName + colorHex, zodat de listing één kaart met
// kleurkeuze toont. Rousseau: op basis-SKU (51940-2 → model 51940).
// Overige bronnen: op naam (identiek op de kleur na). Reeds gegroepeerde
// producten (colorGroup gezet) blijven ongemoeid.
//
// Dry-run: npx tsx scripts/group-color-variants.ts
// Apply:   npx tsx scripts/group-color-variants.ts --apply
import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Kleurwoorden (langste eerst) + representatieve hex.
const HEX: Record<string, string> = {
  "donkergrijs": "#4A4744", "lichtgrijs": "#BDBBB6", "donkerbruin": "#4A3527", "lichtbruin": "#A47B53",
  "donkerblauw": "#2A3B53", "gebroken wit": "#EFEDE6", "donkere eik": "#6B4F31", "eik naturel": "#C8A877",
  "mango hout": "#8A5A3B", "antraciet": "#36353A", "terracotta": "#B05C3B", "travertin": "#C9B79C",
  "naturel": "#C8A877", "bordeaux": "#5B2A2E", "mosterd": "#C99A2E", "cognac": "#9A5B33", "camel": "#B68A5B",
  "taupe": "#9C8B78", "ecru": "#E8E0CE", "crème": "#EFE7D6", "creme": "#EFE7D6", "beige": "#D8C7A8",
  "zand": "#D2BE97", "olijf": "#6B6E4A", "oker": "#C9913B", "grijs": "#8E8B85", "bruin": "#6F4E37",
  "zwart": "#1C1C1C", "blauw": "#3E5C76", "groen": "#5A6E54", "rood": "#8E3B36", "roze": "#D7A9AE",
  "goud": "#C8A96A", "zilver": "#BFC1C2", "brons": "#7A5A3A", "wit": "#F5F5F0", "eik": "#B89B6E",
  "walnoot": "#5A4632", "cement": "#A8A39B", "steen": "#B5B0A8", "marmer": "#E6E3DE", "decor": "#B0976E",
  "sonoma": "#C9A876", "crimson": "#8E3B36",
};
const COLORS = Object.keys(HEX).sort((a, b) => b.length - a.length);
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const baseSku = (sku: string) => sku.replace(/-\d+$/, "");
function detectColor(name: string, specKleur?: string): string | null {
  if (specKleur && specKleur.trim()) return specKleur.trim();
  const n = name.toLowerCase();
  for (const c of COLORS) if (n.includes(c)) return c.charAt(0).toUpperCase() + c.slice(1);
  return null;
}
function modelKeyByName(name: string, color: string | null): string {
  let k = name.toLowerCase();
  if (color) k = k.replace(color.toLowerCase(), " ");
  return k.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  const prods = await p.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, category: true, source: true, specs: true, colorGroup: true, stock: true, hidden: true },
  });

  type Item = { id: string; name: string; category: string; color: string | null };
  const groups = new Map<string, Item[]>();
  let alreadyGrouped = 0;

  for (const pr of prods) {
    if (pr.colorGroup) { alreadyGrouped++; continue; } // niet aanraken
    let specs: Record<string, string> = {}; try { specs = JSON.parse(pr.specs || "{}"); } catch {}
    const color = detectColor(pr.name, specs.Kleur);
    let key: string | null = null;
    if (pr.source === "Rousseau" && specs.Artikelnummer) {
      key = `rss:${pr.category}:${baseSku(specs.Artikelnummer)}`;
    } else {
      const mk = modelKeyByName(pr.name, color);
      if (mk.length >= 4) key = `name:${pr.category}:${mk}`;
    }
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push({ id: pr.id, name: pr.name, category: pr.category, color });
  }

  // Alleen echte kleurgroepen: ≥2 leden én ≥2 verschillende kleuren.
  const updates: { id: string; colorGroup: string; colorName: string | null; colorHex: string | null }[] = [];
  let groupCount = 0;
  const sample: string[] = [];
  for (const [key, items] of groups) {
    const distinctColors = new Set(items.map((i) => (i.color || "").toLowerCase()).filter(Boolean));
    if (items.length < 2 || distinctColors.size < 2) continue;
    groupCount++;
    const cg = slugify(key);
    for (const it of items) {
      const hex = it.color ? HEX[it.color.toLowerCase()] ?? null : null;
      updates.push({ id: it.id, colorGroup: cg, colorName: it.color, colorHex: hex });
    }
    if (sample.length < 10) sample.push(`  ${items.length}× [${items[0].category}] ${items[0].name.slice(0, 40)} … (${[...distinctColors].join(", ")})`);
  }

  console.log(`\nProducten: ${prods.length} · al gegroepeerd (overgeslagen): ${alreadyGrouped}`);
  console.log(`Nieuwe kleurgroepen: ${groupCount} · producten erin: ${updates.length}`);
  console.log(`\nVoorbeelden:\n${sample.join("\n")}`);

  if (APPLY) {
    for (const u of updates) await p.product.update({ where: { id: u.id }, data: { colorGroup: u.colorGroup, colorName: u.colorName, colorHex: u.colorHex } });
    console.log(`\n✅ Toegepast op ${updates.length} producten.`);
  } else console.log("\n(DRY-RUN — run met --apply)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
