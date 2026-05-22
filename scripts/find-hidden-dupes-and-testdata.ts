// Analyseer de verborgen producten: welke zijn echt-duplicaat van een zichtbaar
// product, en welke ogen als testdata (afwijkende slug-patronen).
//
// Output 3 buckets:
//   1. ECHT-DUPLICAAT — zichtbaar product met genormaliseerde gelijke slug bestaat
//   2. LIJKT-TESTDATA — slug bevat verdachte tokens (cijfers in naam, "test", etc.)
//   3. UNIEK-VERBORGEN — geen duplicaat, geen test-patroon (bewuste hide)
//
// Run:
//   npx tsx scripts/find-hidden-dupes-and-testdata.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

// Slug-normalisatie: zelfde typo-fixes als dedupe-products.ts + strip variant-suffix
const TYPO_MAP: Record<string, string> = {
  amerivano: "americano",
  pachinho: "pachino",
};

function normalizeSlug(slug: string): string {
  let s = slug.toLowerCase();
  for (const [bad, good] of Object.entries(TYPO_MAP)) {
    s = s.replace(new RegExp(bad, "g"), good);
  }
  // Strip variant suffixen: -p\d+, -2, -kopie, -copy
  s = s.replace(/-p\d+$/, "");
  s = s.replace(/-\d+$/, "");
  s = s.replace(/-(kopie|copy)$/, "");
  // Strip kleur-token aan einde (-grijs, -goud, etc.) zodat color-variants als
  // duplicaat herkend worden bij verschillende kleur-versies
  s = s.replace(/-(grijs|goud|wit|zwart|blauw|groen|bruin|cremeer|crème|naturel)$/, "");
  return s;
}

// Testdata-patronen: opvallend ongebruikelijk in echte product-naamgeving
function looksLikeTestdata(slug: string, name: string): { match: true; reason: string } | { match: false } {
  // Cijfers midden in een woord (abramo3, l2e, etc.)
  if (/[a-z]\d+[a-z]?-/.test(slug) || /-[a-z]\d+[a-z]?$/.test(slug)) {
    return { match: true, reason: "cijfers in slug-segment" };
  }
  // Random lijkende korte alfanumeric tokens (l2e, p8, etc.)
  if (/-[a-z]\d[a-z]?$/.test(slug)) {
    return { match: true, reason: "korte alfanumeric suffix" };
  }
  // Bekende test-tokens
  const testTokens = ["test", "dummy", "draft", "tmp", "temp", "xx", "abc"];
  for (const t of testTokens) {
    if (slug.includes(t)) return { match: true, reason: `bevat "${t}"` };
  }
  // Yola, amerivano, abramo zijn specifiek door user genoemd als verdacht
  if (/yola|abramo|ares/i.test(name)) {
    return { match: true, reason: "ongebruikelijke productnaam" };
  }
  return { match: false };
}

async function main() {
  const all = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { slug: true, name: true, hidden: true, images: true, price: true, category: true },
  });

  const visible = all.filter((p) => !p.hidden);
  const hidden = all.filter((p) => p.hidden);

  // Map: normalized slug → list of visible products
  const visibleBySlug = new Map<string, { slug: string; name: string }[]>();
  for (const p of visible) {
    const norm = normalizeSlug(p.slug);
    if (!visibleBySlug.has(norm)) visibleBySlug.set(norm, []);
    visibleBySlug.get(norm)!.push(p);
  }

  type Bucket = "duplicate" | "testdata" | "unique";
  const buckets: Record<Bucket, { slug: string; name: string; imgs: number; note: string }[]> = {
    duplicate: [],
    testdata: [],
    unique: [],
  };

  // Ook: duplicaten BINNEN de hidden-set (Pachino Bank x2)
  const hiddenBySlug = new Map<string, { slug: string; name: string }[]>();
  for (const p of hidden) {
    const norm = normalizeSlug(p.slug);
    if (!hiddenBySlug.has(norm)) hiddenBySlug.set(norm, []);
    hiddenBySlug.get(norm)!.push(p);
  }

  for (const p of hidden) {
    const norm = normalizeSlug(p.slug);
    const imgs = parseImages(p.images).length;
    const visibleMatch = visibleBySlug.get(norm);
    const hiddenMatches = hiddenBySlug.get(norm) ?? [];

    if (visibleMatch && visibleMatch.length > 0) {
      buckets.duplicate.push({
        slug: p.slug,
        name: p.name,
        imgs,
        note: `zichtbaar: ${visibleMatch.map((v) => v.slug).join(", ")}`,
      });
      continue;
    }
    if (hiddenMatches.length > 1) {
      const others = hiddenMatches.filter((h) => h.slug !== p.slug).map((h) => h.slug);
      buckets.duplicate.push({
        slug: p.slug,
        name: p.name,
        imgs,
        note: `2x verborgen: ${others.join(", ")}`,
      });
      continue;
    }
    const test = looksLikeTestdata(p.slug, p.name);
    if (test.match) {
      buckets.testdata.push({ slug: p.slug, name: p.name, imgs, note: test.reason });
      continue;
    }
    buckets.unique.push({ slug: p.slug, name: p.name, imgs, note: "" });
  }

  function printBucket(title: string, items: typeof buckets.duplicate) {
    console.log(`\n─── ${title} (${items.length}) ───`);
    if (items.length === 0) {
      console.log("  (geen)");
      return;
    }
    for (const i of items) {
      console.log(`  ${i.imgs.toString().padStart(2)} foto's  ${i.slug.padEnd(40)}  ${i.note}`);
    }
  }

  printBucket("ECHT-DUPLICAAT — zichtbaar tegenhanger bestaat", buckets.duplicate);
  printBucket("LIJKT TESTDATA — afwijkende naamgeving", buckets.testdata);
  printBucket("UNIEK-VERBORGEN — bewuste hide, geen duplicaat", buckets.unique);

  const fotosWeg = buckets.duplicate.reduce((s, i) => s + i.imgs, 0)
    + buckets.testdata.reduce((s, i) => s + i.imgs, 0);
  console.log(`\n─── Samenvatting ───`);
  console.log(`  Echt-duplicaat:   ${buckets.duplicate.length} producten, ${buckets.duplicate.reduce((s, i) => s + i.imgs, 0)} foto's`);
  console.log(`  Lijkt testdata:   ${buckets.testdata.length} producten, ${buckets.testdata.reduce((s, i) => s + i.imgs, 0)} foto's`);
  console.log(`  Uniek-verborgen:  ${buckets.unique.length} producten, ${buckets.unique.reduce((s, i) => s + i.imgs, 0)} foto's`);
  console.log(`  Te besparen indien duplicaat+testdata weg: ${fotosWeg} foto's`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
