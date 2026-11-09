// Past een goedgekeurd varianten-voorstel toe: per product colorGroup (= model),
// sizeName (maat binnen het model) en colorName/colorHex (kleur).
//
//   npx tsx --env-file=.env.local scripts/apply-variant-groups.ts <proposal.json>          # dry-run
//   npx tsx --env-file=.env.local scripts/apply-variant-groups.ts <proposal.json> --apply  # schrijven
//
// Wijzigt GEEN prijs, voorraad, foto's, naam, slug of zichtbaarheid. Vereist de
// migratie 20261106120000_product_size_name (kolom "sizeName").
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const db = new PrismaClient();
const FILE = process.argv[2];
const APPLY = process.argv.includes("--apply");

interface ProposalItem {
  id: string;
  slug: string;
  name: string;
  sizeName: string | null;
  colorName: string | null;
  colorHex: string | null;
}
interface ProposalGroup {
  groupId: string;
  model: string;
  category: string;
  items: ProposalItem[];
}

// Kleurwoord → representatieve staalkleur (zelfde waarden als group-color-variants).
const HEX: Record<string, string> = {
  donkergrijs: "#4A4744", lichtgrijs: "#BDBBB6", donkerbruin: "#4A3527", lichtbruin: "#A47B53",
  donkerblauw: "#2A3B53", "gebroken wit": "#EFEDE6", antraciet: "#36353A", terracotta: "#B05C3B",
  travertin: "#C9B79C", naturel: "#C8A877", bordeaux: "#5B2A2E", mosterd: "#C99A2E", cognac: "#9A5B33",
  camel: "#B68A5B", taupe: "#9C8B78", ecru: "#E8E0CE", crème: "#EFE7D6", creme: "#EFE7D6", beige: "#D8C7A8",
  greige: "#B9AE9C", zand: "#D2BE97", olijf: "#6B6E4A", oker: "#C9913B", grijs: "#8E8B85", bruin: "#6F4E37",
  zwart: "#1C1C1C", blauw: "#3E5C76", groen: "#5A6E54", rood: "#8E3B36", roze: "#D7A9AE", goud: "#C8A96A",
  zilver: "#BFC1C2", brons: "#7A5A3A", wit: "#F5F5F0", eiken: "#B89B6E", eik: "#B89B6E", walnoot: "#5A4632",
  pecan: "#8B5E3C", chestnut: "#6E4630", espresso: "#3B2A20", karamel: "#A86B3C", roest: "#9A4E2E",
  oranje: "#C9773B", pandora: "#8A6A3F", goudbruin: "#8A6A3F", malta: "#9B8466", basalt: "#4D4B48",
  flintstone: "#8F8A82", crimson: "#8E3B36", sonoma: "#C9A876", ivoor: "#EFE9DA",
  // Materiaalwoorden: alleen als er geen echte kleur in de naam staat.
  steen: "#B5B0A8", marmer: "#E6E3DE", cement: "#A8A39B", decor: "#B0976E",
};
const MATERIAL = new Set(["steen", "marmer", "cement", "decor"]);

/** Eerste kleurwoord in de naam (materiaal alleen als terugval). */
function hexFor(colorName: string | null): string | null {
  if (!colorName) return null;
  const words = colorName.toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean);
  const first = words.find((w) => HEX[w] && !MATERIAL.has(w)) ?? words.find((w) => HEX[w]);
  return first ? HEX[first] : null;
}

(async () => {
  if (!FILE) throw new Error("Geef het pad naar proposal.json mee");
  const groups = JSON.parse(readFileSync(FILE, "utf8")) as ProposalGroup[];
  const items = groups.flatMap((g) => g.items.map((i) => ({ ...i, groupId: g.groupId })));

  const current = await db.product.findMany({
    where: { id: { in: items.map((i) => i.id) }, deletedAt: null },
    select: { id: true, colorGroup: true, colorName: true, colorHex: true, sizeName: true },
  });
  const byId = new Map(current.map((p) => [p.id, p]));

  const updates = items.flatMap((i) => {
    const cur = byId.get(i.id);
    if (!cur) return [];
    const data = {
      colorGroup: i.groupId,
      sizeName: i.sizeName,
      colorName: i.colorName,
      colorHex: hexFor(i.colorName) ?? cur.colorHex,
    };
    const changed =
      cur.colorGroup !== data.colorGroup ||
      cur.sizeName !== data.sizeName ||
      cur.colorName !== data.colorName ||
      cur.colorHex !== data.colorHex;
    return changed ? [{ id: i.id, name: i.name, data }] : [];
  });

  const missing = items.length - current.length;
  console.log(`${groups.length} modellen, ${items.length} producten in voorstel; ${missing} niet (meer) gevonden; ${updates.length} te wijzigen.`);
  for (const u of updates.slice(0, 15)) {
    console.log(`  ${u.name}  →  groep=${u.data.colorGroup}  maat=${u.data.sizeName ?? "—"}  kleur=${u.data.colorName ?? "—"} ${u.data.colorHex ?? ""}`);
  }
  if (updates.length > 15) console.log(`  … en ${updates.length - 15} meer`);

  if (!APPLY) {
    console.log("\nDry-run: niets geschreven. Voeg --apply toe om te schrijven.");
    await db.$disconnect();
    return;
  }

  // In batches van 50 per transactie (Neon serverless).
  for (let k = 0; k < updates.length; k += 50) {
    const batch = updates.slice(k, k + 50);
    await db.$transaction(batch.map((u) => db.product.update({ where: { id: u.id }, data: u.data })));
    console.log(`  geschreven: ${Math.min(k + 50, updates.length)}/${updates.length}`);
  }
  console.log("Klaar.");
  await db.$disconnect();
})().catch(async (e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  await db.$disconnect();
  process.exit(1);
});
