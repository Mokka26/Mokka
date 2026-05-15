// Vind producten die mogelijk dezelfde foto's kunnen delen.
// Groepeert op (Serie + Stoffering) + colorGroup.
//
// Run: DATABASE_URL=... npx tsx scripts/find-product-duplicates.ts [category]

import { prisma } from "@/lib/prisma";

async function main() {
  const category = process.argv[2] ?? "hoekbanken";

  const products = await prisma.product.findMany({
    where: { category, hidden: false },
    select: { slug: true, name: true, specs: true, colorGroup: true, colorName: true, images: true },
  });

  console.log(`\n═══ Duplicate-analyse voor: ${category} (${products.length} producten) ═══\n`);

  // ─── Groep 1: identieke (Serie, Stoffering) ───
  const seriesGroups = new Map<string, typeof products>();
  for (const p of products) {
    const specs = p.specs ? JSON.parse(p.specs) : {};
    const key = `${specs.Serie ?? "?"} · ${specs.Stoffering ?? "?"}`;
    const arr = seriesGroups.get(key) ?? [];
    arr.push(p);
    seriesGroups.set(key, arr);
  }

  console.log("─── Groep op (Serie + Stoffering) ────────────────");
  for (const [key, group] of seriesGroups) {
    if (group.length === 1) continue;
    console.log(`\n  ${key}  — ${group.length} producten:`);
    for (const p of group) {
      const imgCount = JSON.parse(p.images || "[]").length;
      console.log(`    · ${p.slug.padEnd(35)} (${imgCount} foto's, kleur: ${p.colorName ?? "—"}, colorGroup: ${p.colorGroup ?? "—"})`);
    }
  }

  // ─── Groep 2: colorGroup matches ───
  console.log("\n\n─── Groep op colorGroup ──────────────────────────");
  const colorGroups = new Map<string, typeof products>();
  for (const p of products) {
    if (!p.colorGroup) continue;
    const arr = colorGroups.get(p.colorGroup) ?? [];
    arr.push(p);
    colorGroups.set(p.colorGroup, arr);
  }
  for (const [key, group] of colorGroups) {
    if (group.length === 1) continue;
    console.log(`\n  colorGroup: ${key} — ${group.length} producten:`);
    for (const p of group) {
      console.log(`    · ${p.slug.padEnd(35)} (kleur: ${p.colorName ?? "—"})`);
    }
  }

  // ─── Standalones (geen overlap) ───
  console.log("\n\n─── Standalones (uniek) ──────────────────────────");
  const inGroup = new Set<string>();
  for (const group of seriesGroups.values()) {
    if (group.length > 1) for (const p of group) inGroup.add(p.slug);
  }
  for (const p of products) {
    if (!inGroup.has(p.slug)) console.log(`  · ${p.slug}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
