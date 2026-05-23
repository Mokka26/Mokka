// Audit verlichting-foto's op kwaliteit:
//   - Producten zonder foto's (lege images JSON)
//   - Producten met te-kleine foto's (<30KB = placeholder/icon)
//   - Producten met te-kleine resolutie (<400×400px)
//   - Producten met afwijkende aspect ratio (logo's, schema's)
//   - Producten met maar 1 foto waar het hele assortiment ≥2 heeft

import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";
import { extractPublicId } from "@/lib/cloudinary-helpers";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const MIN_BYTES = 30 * 1024;
const MIN_DIM = 400;

async function loadMeta() {
  const m = new Map<string, { bytes: number; width?: number; height?: number; format?: string }>();
  let cursor: string | undefined;
  do {
    const r = await cloudinary.api.resources({
      type: "upload",
      prefix: "mokka",
      max_results: 500,
      next_cursor: cursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const item of r.resources) {
      m.set(item.public_id, {
        bytes: item.bytes ?? 0,
        width: item.width,
        height: item.height,
        format: item.format,
      });
    }
    cursor = r.next_cursor;
  } while (cursor);
  return m;
}

async function main() {
  console.log("\n═══ Verlichting foto-audit ═══\n");

  const products = await prisma.product.findMany({
    where: { category: "verlichting", deletedAt: null },
    select: { slug: true, name: true, images: true, hidden: true },
    orderBy: { slug: "asc" },
  });

  const meta = await loadMeta();

  const issues = {
    noImages: [] as string[],
    placeholder: [] as { slug: string; pid: string; kb: number; w?: number; h?: number }[],
    lowRes: [] as { slug: string; pid: string; dim: string }[],
    extremeAspect: [] as { slug: string; pid: string; ratio: number }[],
    missingMeta: [] as { slug: string; pid: string }[],
  };

  let totalProducts = 0;
  let totalPhotos = 0;
  let withPhotos = 0;

  for (const p of products) {
    totalProducts++;
    const imgs = parseImages(p.images);
    if (imgs.length === 0) {
      issues.noImages.push(p.slug);
      continue;
    }
    withPhotos++;
    totalPhotos += imgs.length;

    for (const img of imgs) {
      const pid = extractPublicId(img.url);
      if (!pid) continue;
      const m = meta.get(pid);
      if (!m) {
        issues.missingMeta.push({ slug: p.slug, pid });
        continue;
      }
      // Klein bestand = mogelijk placeholder
      if (m.bytes < MIN_BYTES) {
        issues.placeholder.push({ slug: p.slug, pid, kb: Math.round(m.bytes / 1024), w: m.width, h: m.height });
      }
      // Lage resolutie
      if (m.width && m.height && (m.width < MIN_DIM || m.height < MIN_DIM)) {
        issues.lowRes.push({ slug: p.slug, pid, dim: `${m.width}×${m.height}` });
      }
      // Extreme aspect (logo of schema: meestal heel breed of heel smal)
      if (m.width && m.height) {
        const ratio = m.width / m.height;
        if (ratio > 3 || ratio < 0.33) {
          issues.extremeAspect.push({ slug: p.slug, pid, ratio: Math.round(ratio * 100) / 100 });
        }
      }
    }
  }

  console.log(`Totaal verlichting: ${totalProducts} producten, ${totalPhotos} foto's\n`);

  console.log(`─── 🔴 Zonder foto's (${issues.noImages.length}) ───`);
  for (const s of issues.noImages) console.log(`  ${s}`);

  console.log(`\n─── 🔴 Placeholder/icon-formaat <30KB (${issues.placeholder.length}) ───`);
  for (const i of issues.placeholder.slice(0, 30)) {
    console.log(`  ${i.kb.toString().padStart(3)}KB  ${(i.w && i.h ? `${i.w}×${i.h}` : "?").padEnd(11)}  ${i.pid}`);
  }
  if (issues.placeholder.length > 30) console.log(`  ... en ${issues.placeholder.length - 30} meer`);

  console.log(`\n─── ⚠ Lage resolutie <${MIN_DIM}px (${issues.lowRes.length}) ───`);
  for (const i of issues.lowRes.slice(0, 30)) {
    console.log(`  ${i.dim.padEnd(11)} ${i.pid}`);
  }
  if (issues.lowRes.length > 30) console.log(`  ... en ${issues.lowRes.length - 30} meer`);

  console.log(`\n─── ⚠ Extreme aspect ratio (${issues.extremeAspect.length}) ───`);
  for (const i of issues.extremeAspect.slice(0, 20)) {
    console.log(`  ratio ${i.ratio}  ${i.pid}`);
  }
  if (issues.extremeAspect.length > 20) console.log(`  ... en ${issues.extremeAspect.length - 20} meer`);

  console.log(`\n─── Cloudinary asset niet gevonden (${issues.missingMeta.length}) ───`);
  for (const i of issues.missingMeta.slice(0, 10)) {
    console.log(`  ${i.pid}  (van ${i.slug})`);
  }
  if (issues.missingMeta.length > 10) console.log(`  ... en ${issues.missingMeta.length - 10} meer`);

  // Top getroffen producten
  const productHits = new Map<string, number>();
  const allIssues = [
    ...issues.placeholder.map((i) => i.slug),
    ...issues.lowRes.map((i) => i.slug),
    ...issues.extremeAspect.map((i) => i.slug),
    ...issues.missingMeta.map((i) => i.slug),
  ];
  for (const s of allIssues) productHits.set(s, (productHits.get(s) ?? 0) + 1);
  const topHits = Array.from(productHits.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);

  console.log(`\n─── Top 15 producten met meeste issues ───`);
  for (const [slug, n] of topHits) {
    console.log(`  ${n}× ${slug}`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
