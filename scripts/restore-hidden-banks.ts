// Restore hidden bank-products die ten onrechte verborgen zijn:
//   - Skip exacte duplicaten (slug eindigt op -p\d+ zoals anna-bank-p8)
//   - Skip bekende typo's (amerivano = americano, pachinho = pachino)
//   - Skip 1-foto placeholders zonder echte content
//   - Unhide de rest
//   - Verifieer dat alle Cloudinary URLs werken (HEAD-check)
//
// Run:
//   npx tsx scripts/restore-hidden-banks.ts             # dry-run
//   npx tsx scripts/restore-hidden-banks.ts --apply

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";

const APPLY = process.argv.includes("--apply");

// True duplicates / typo's blijven hidden
const KEEP_HIDDEN_SLUGS = new Set([
  "amerivano-bank",           // typo van americano-bank
  "ares-l2e-bank",            // placeholder 1 foto
  "cloud-abramo3-bank",       // placeholder 1 foto
  "pachinho-bank",            // typo van pachino-bank
  // -p<N> suffix duplicates
  "anna-bank-p8",
  "clara-bank-p34",
  "cloud-bank-p10",
  "pachino-bank-p42",
]);

function isDuplicate(slug: string): boolean {
  if (KEEP_HIDDEN_SLUGS.has(slug)) return true;
  if (/-p\d+$/.test(slug)) return true; // generic -p<N> suffix
  return false;
}

async function headCheck(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch { return false; }
}

async function main() {
  console.log(`\n═══ Restore hidden banks ═══`);
  console.log(`  Apply: ${APPLY ? "YES" : "no (dry-run)"}\n`);

  const hidden = await prisma.product.findMany({
    where: {
      category: { in: ["banken", "hoekbanken", "bankstellen"] },
      hidden: true,
      deletedAt: null,
    },
    select: { id: true, slug: true, name: true, category: true, images: true },
  });

  const toRestore: typeof hidden = [];
  const toKeep: typeof hidden = [];
  for (const p of hidden) {
    if (isDuplicate(p.slug)) toKeep.push(p); else toRestore.push(p);
  }

  console.log(`Hidden in 3 bank-categorieën: ${hidden.length}`);
  console.log(`  → restore: ${toRestore.length}`);
  console.log(`  → keep hidden (dups/typos): ${toKeep.length}\n`);

  console.log(`─── Te restoren ───`);
  // Cloudinary HEAD-check op hero van elk
  const restoreOk: typeof toRestore = [];
  const restoreBroken: { p: typeof toRestore[number]; brokenUrl: string }[] = [];

  for (const p of toRestore) {
    const imgs = parseImages(p.images);
    const hero = imgs[0]?.url;
    let ok = true;
    if (hero) {
      ok = await headCheck(hero);
    }
    const flag = ok ? "✓" : "✗ HERO BROKEN";
    console.log(`  ${flag.padEnd(20)} [cat=${p.category.padEnd(12)}] ${p.slug.padEnd(40)} #=${imgs.length}  ${p.name}`);
    if (ok) restoreOk.push(p);
    else restoreBroken.push({ p, brokenUrl: hero ?? "(geen hero)" });
  }

  console.log(`\n─── Hidden blijven (dups/typos) ───`);
  for (const p of toKeep) {
    console.log(`  [cat=${p.category.padEnd(12)}] ${p.slug.padEnd(40)} ${p.name}`);
  }

  if (restoreBroken.length > 0) {
    console.log(`\n─── ⚠ Hero broken (skip restore) ───`);
    for (const { p, brokenUrl } of restoreBroken) {
      console.log(`  ${p.slug}: ${brokenUrl}`);
    }
  }

  if (!APPLY) { console.log(`\n[DRY-RUN]`); return; }

  console.log(`\n─── Unhiden ───`);
  await prisma.$transaction(
    restoreOk.map((p) => prisma.product.update({ where: { id: p.id }, data: { hidden: false } })),
  );
  console.log(`✓ ${restoreOk.length} producten zichtbaar gemaakt`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
