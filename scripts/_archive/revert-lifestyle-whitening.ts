// Revert verkeerde whitening:
//   - Alleen positie [0] (hero) hoort -white te zijn
//   - Alle andere -white URLs zijn lifestyle/scene foto's die de woonkamer-bg moeten houden
//   - Voor elke verkeerd-gewhitende foto:
//       * Revert URL naar origineel (strip "-white" uit publicId)
//       * Push orphan -white asset naar DeletedImage tabel (auto-purge na 30 dagen)
//
// Run:
//   npx tsx scripts/revert-lifestyle-whitening.ts            # dry-run
//   npx tsx scripts/revert-lifestyle-whitening.ts --apply

import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";
import { extractPublicId } from "@/lib/cloudinary-helpers";

const APPLY = process.argv.includes("--apply");

function isWhitened(url: string): boolean {
  return /-white\.(jpe?g|png|webp)$/i.test(url);
}

function originalUrl(whitenedUrl: string): string {
  return whitenedUrl.replace(/-white(\.[a-z]+)$/i, "$1");
}

async function main() {
  console.log(`\n═══ Revert lifestyle whitening ═══`);
  console.log(`  Apply: ${APPLY ? "YES" : "no (dry-run)"}\n`);

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, images: true },
  });

  type Revert = {
    productId: string;
    slug: string;
    position: number;
    oldUrl: string;       // de -white URL die we orphannen
    newUrl: string;       // de originele URL waar we naar terug gaan
    publicId: string;     // -white publicId voor DeletedImage
  };

  const reverts: Revert[] = [];

  for (const p of products) {
    const imgs = parseImages(p.images);
    for (let i = 0; i < imgs.length; i++) {
      // Alleen positie > 0 reverten. Positie 0 (hero) blijft -white.
      if (i === 0) continue;
      const url = imgs[i].url;
      if (!isWhitened(url)) continue;
      const pid = extractPublicId(url);
      if (!pid) continue;
      reverts.push({
        productId: p.id,
        slug: p.slug,
        position: i,
        oldUrl: url,
        newUrl: originalUrl(url),
        publicId: pid,
      });
    }
  }

  console.log(`Te reverten: ${reverts.length} foto's (lifestyle scenes)\n`);
  for (const r of reverts) {
    console.log(`  ${r.slug.padEnd(40)} [${r.position}]  ${r.publicId.split("/").slice(-2).join("/")}`);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN]`);
    return;
  }

  // Groepeer per product voor DB update
  const byProduct = new Map<string, Revert[]>();
  for (const r of reverts) {
    if (!byProduct.has(r.productId)) byProduct.set(r.productId, []);
    byProduct.get(r.productId)!.push(r);
  }

  console.log(`\n─── Reverten + orphan markeren ───`);
  for (const [productId, rs] of byProduct) {
    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true, images: true },
    });
    if (!p) continue;
    const imgs = parseImages(p.images);

    // Replace -white met original op de juiste posities
    const urlMap = new Map(rs.map((r) => [r.oldUrl, r.newUrl]));
    const newImgs = imgs.map((i) => {
      const replacement = urlMap.get(i.url);
      return replacement ? { url: replacement, w: i.w, h: i.h } : i;
    });

    // Verify originele URLs nog bestaan (HEAD-check)
    for (const r of rs) {
      try {
        const status = await fetch(r.newUrl, { method: "HEAD", signal: AbortSignal.timeout(8000) })
          .then((res) => res.status);
        if (status >= 400) {
          console.error(`  ⚠ ${r.slug} [${r.position}]: origineel niet meer beschikbaar (${status}) — skip`);
          // Hou -white URL als de originele dood is
          const idx = imgs.findIndex((i) => i.url === r.oldUrl);
          if (idx >= 0) newImgs[idx] = imgs[idx];
          continue;
        }
      } catch {
        console.error(`  ⚠ ${r.slug} [${r.position}]: origineel check faalde — skip`);
      }
    }

    // Tx: update product + push -white naar DeletedImage
    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { images: JSON.stringify(newImgs) },
      }),
      ...rs.map((r) =>
        prisma.deletedImage.create({
          data: {
            productId,
            productSlug: r.slug,
            publicId: r.publicId,
            url: r.oldUrl,
            w: null,
            h: null,
          },
        }),
      ),
    ]);

    console.log(`  ✓ ${p.slug}: ${rs.length} foto's gerevert + ${rs.length} -white assets naar prullenbak`);
  }

  console.log(`\n✓ Klaar. Bekijk /admin/trash voor de orphan -white assets (auto-purge over 30 dagen).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
