// Dedupe duplicate products by normalized slug.
//
// Normalisatie:
//   - strip "-p\d+" suffix (anna-bank-p8 -> anna-bank)
//   - fix typo's via TYPO_MAP (amerivano -> americano, pachinho -> pachino)
//   - lowercase, strip generieke type-tokens voor groepering
//
// Voor elke groep met >1 producten:
//   - Primary = product met de meeste foto's (en sub-tiebreak: heeft Copilot, langste descrip)
//   - Anderen: gemarkeerd als hidden=true (NIET verwijderd zodat user kan reviewen)
//
// Run:
//   npx tsx scripts/dedupe-products.ts           # dry-run
//   npx tsx scripts/dedupe-products.ts --apply   # markeer hidden

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

// Typo-fixes (key wordt in slug vervangen door value voor groepering)
const TYPO_MAP: Record<string, string> = {
  amerivano: "americano",
  pachinho: "pachino",
};

function normalizeSlug(slug: string): string {
  let s = slug.toLowerCase();
  // strip -p\d+ suffix
  s = s.replace(/-p\d+$/, "");
  // typo fixes
  for (const [bad, good] of Object.entries(TYPO_MAP)) {
    s = s.replace(new RegExp(`\\b${bad}\\b`, "g"), good);
  }
  return s;
}

type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  images: string;
  description: string;
  hidden: boolean;
  createdAt: Date;
};

function score(p: Product): number {
  const imgCount = parseImages(p.images).length;
  const hasCopilot = p.images.includes("/copilot-");
  const descLen = p.description.length;
  // Hoofdsignaal = aantal foto's; tiebreak = Copilot aanwezig; tiebreak = beschrijving-lengte
  return imgCount * 1000 + (hasCopilot ? 500 : 0) + Math.min(descLen, 499);
}

async function main() {
  console.log(`\n═══ Dedupe products ═══`);
  console.log(`  Apply: ${APPLY ? "YES (will set hidden=true)" : "no (dry-run)"}\n`);

  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      images: true,
      description: true,
      hidden: true,
      createdAt: true,
    },
    where: { hidden: false },
  });

  // Groep op normalized slug
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const key = normalizeSlug(p.slug);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const dups = Array.from(groups.entries()).filter(([, ps]) => ps.length > 1);
  console.log(`Gevonden: ${dups.length} groepen met duplicaten\n`);

  if (dups.length === 0) {
    console.log(`Geen duplicaten. Klaar.`);
    return;
  }

  const toHide: { id: string; slug: string; reason: string }[] = [];

  for (const [key, ps] of dups) {
    // Sorteer score DESC — primary = ps[0]
    const sorted = [...ps].sort((a, b) => score(b) - score(a));
    const primary = sorted[0];
    const losers = sorted.slice(1);

    console.log(`▶ ${key}  (${ps.length}x)`);
    console.log(`  PRIMARY: ${primary.slug}  → ${parseImages(primary.images).length} foto's, ${primary.description.length}ch desc`);
    for (const l of losers) {
      const imgC = parseImages(l.images).length;
      console.log(`  hide:    ${l.slug}  → ${imgC} foto's, ${l.description.length}ch desc`);
      toHide.push({
        id: l.id,
        slug: l.slug,
        reason: `dedupe groep "${key}", primary=${primary.slug}`,
      });
    }
    console.log();
  }

  console.log(`Totaal te verbergen: ${toHide.length}`);

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Geen wijzigingen. Run met --apply.`);
    return;
  }

  console.log(`\n─── Markeren als hidden ───`);
  for (const h of toHide) {
    await prisma.product.update({ where: { id: h.id }, data: { hidden: true } });
    console.log(`  ✓ hidden: ${h.slug}`);
  }
  console.log(`\n✓ Klaar.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
