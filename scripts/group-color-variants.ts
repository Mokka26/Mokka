/**
 * Detecteert kleurvarianten op basis van productnaam en groepeert
 * ze via colorGroup / colorName / colorHex velden.
 *
 * Logica:
 *   - Pak laatste woord van naam (bv. "Lucce Bankstel Bruin" → "Bruin")
 *   - Match tegen lijst van bekende kleurnamen
 *   - Groep = naam zonder kleurwoord (slugified)
 *   - Producten met zelfde groep + 2+ varianten worden gelinkt
 *
 * Gebruik:
 *   npx tsx scripts/group-color-variants.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const prisma = new PrismaClient();

const COLORS: Record<string, string> = {
  "grijs": "#6E6E6E",
  "bruin": "#7A5A3F",
  "beige": "#D7C9AA",
  "goud": "#C9A961",
  "brons": "#8B6F47",
  "zwart": "#1C1C1C",
  "wit": "#F5F5F0",
  "creme": "#EFE6D2",
  "crème": "#EFE6D2",
  "cr-me": "#EFE6D2",
  "naturel": "#C9A86E",
  "rood": "#8B2E2E",
  "blauw": "#4A6B8B",
  "antraciet": "#3D3D3D",
  "groen": "#4A6B4A",
  "oranje": "#C97B47",
  "geel": "#D9B847",
  "roze": "#D9A8B0",
  "ecru": "#E8DCC8",
  "taupe": "#8B7E72",
  "chroom": "#B8B8B8",
};

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function detectColor(name: string): { color: string; baseName: string; hex: string } | null {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return null;

  const last = words[words.length - 1].toLowerCase();
  const lastNormalized = last.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const hex = COLORS[last] ?? COLORS[lastNormalized];
  if (!hex) return null;

  const baseName = words.slice(0, -1).join(" ");
  return { color: words[words.length - 1], baseName, hex };
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, colorGroup: true },
    orderBy: { name: "asc" },
  });

  // Groepeer per detected baseName
  const groups = new Map<string, { id: string; slug: string; name: string; color: string; hex: string }[]>();

  for (const p of products) {
    const detected = detectColor(p.name);
    if (!detected) continue;
    const groupKey = slugify(detected.baseName);
    if (!groupKey) continue;
    const arr = groups.get(groupKey) ?? [];
    arr.push({ id: p.id, slug: p.slug, name: p.name, color: detected.color, hex: detected.hex });
    groups.set(groupKey, arr);
  }

  // Alleen groepen met 2+ varianten
  const validGroups = Array.from(groups.entries()).filter(([, items]) => items.length >= 2);

  console.log(`Gevonden: ${validGroups.length} groepen met 2+ varianten\n`);
  for (const [group, items] of validGroups) {
    console.log(`  ${group}:`);
    for (const item of items) {
      console.log(`    - ${item.name} → ${item.color} (${item.hex})`);
    }
  }

  console.log(`\nBijwerken DB...`);
  let updated = 0;
  for (const [group, items] of validGroups) {
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.id },
        data: {
          colorGroup: group,
          colorName: item.color,
          colorHex: item.hex,
        },
      });
      updated++;
    }
  }
  console.log(`${updated} producten gekoppeld via colorGroup`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
