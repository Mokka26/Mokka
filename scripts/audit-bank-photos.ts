// Audit alle bank-producten:
//   1. Folder → product naam match (heeft DB-naam de folder-base?)
//   2. Image URLs: HEAD-status (laad-check)
//   3. White-bg detectie via Cloudinary colors API
//   4. Geprobleemde Copilot foto's
//
// Run:
//   npx tsx scripts/audit-bank-photos.ts
//   npx tsx scripts/audit-bank-photos.ts --slug=bolton-riviera-hoekbank
//   npx tsx scripts/audit-bank-photos.ts --json > audit.json

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/imageHelpers";
import { v2 as cloudinary } from "cloudinary";
import { extractPublicId } from "@/lib/cloudinary-helpers";
import { promises as fs } from "node:fs";
import path from "node:path";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const args = process.argv.slice(2);
const onlySlug = args.find((a) => a.startsWith("--slug="))?.split("=")[1];
const JSON_OUT = args.includes("--json");
const SAMPLE = args.includes("--sample");

// Banks die uit folders kwamen (Copilot + 5 zonder)
const BANK_SLUGS = [
  "bolton-riviera-hoekbank", "california-kemer-hoekbank", "california-magic-hoekbank",
  "fortes-kemer-hoekbank", "jolly-kemer-hoekbank", "mila-monolith-hoekbank",
  "new-bolton-kronos-hoekbank", "new-bolton-riviera-hoekbank",
  "rafaello-relax-decowit-hoekbank", "rosso-soro-hoekbank", "star-kemer-hoekbank",
  "yola-monolith-hoekbank",
  "bonna-monolith-loungebank", "california-magic-loungebank", "rosso-soro-loungebank",
  "star-croco-loungebank", "star-preston-c-loungebank",
  "kingstone-genova-texarm-u-bank", "new-bolton-fresh-u-bank",
  "americano-bank", "anna-bank", "ares-bank", "ares-u-bank", "bella-bank",
  "clara-bank", "cloud-bank",
  "coast-lux-bank", "finn-bank", "moana-bank", "mystic-bank", "new-bolton-bank",
  "anna-hoekbank",
];

type ImageAudit = {
  url: string;
  publicId: string | null;
  status: number | "error";
  isCopilot: boolean;
  whiteRatio: number | null; // 0-1, percentage white-ish in dominant colors
  dominantColors: string[] | null;
};

type ProductAudit = {
  slug: string;
  name: string;
  category: string;
  imageCount: number;
  hero: ImageAudit | null;
  images: ImageAudit[];
  copilotsCount: number;
  copilotsWithoutWhite: number;
  brokenUrls: number;
};

async function headCheck(url: string): Promise<number | "error"> {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return r.status;
  } catch {
    return "error";
  }
}

function isWhitish(hex: string): boolean {
  // #FFFFFF, #F0F0F0, #FAFAFA, etc.
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r >= 235 && g >= 235 && b >= 235;
}

async function colorsFor(publicId: string): Promise<{ whiteRatio: number; colors: string[] } | null> {
  try {
    const r = await cloudinary.api.resource(publicId, { colors: true } as Parameters<typeof cloudinary.api.resource>[1]);
    const colors = (r.colors ?? []) as [string, number][];
    if (!colors.length) return null;
    const whiteRatio = colors
      .filter(([hex]) => isWhitish(hex))
      .reduce((sum, [, pct]) => sum + pct, 0) / 100;
    return { whiteRatio, colors: colors.slice(0, 5).map((c) => `${c[0]}(${c[1].toFixed(0)}%)`) };
  } catch {
    return null;
  }
}

async function auditProduct(slug: string): Promise<ProductAudit | null> {
  const p = await prisma.product.findUnique({
    where: { slug },
    select: { slug: true, name: true, category: true, images: true },
  });
  if (!p) return null;

  const imgs = parseImages(p.images);
  const audits: ImageAudit[] = [];

  for (const img of imgs) {
    const publicId = extractPublicId(img.url);
    const isCopilot = /\/copilot-/i.test(img.url);
    const [status, colors] = await Promise.all([
      headCheck(img.url),
      publicId ? colorsFor(publicId) : Promise.resolve(null),
    ]);
    audits.push({
      url: img.url,
      publicId,
      status,
      isCopilot,
      whiteRatio: colors?.whiteRatio ?? null,
      dominantColors: colors?.colors ?? null,
    });
  }

  const copilotsCount = audits.filter((a) => a.isCopilot).length;
  const copilotsWithoutWhite = audits.filter(
    (a) => a.isCopilot && a.whiteRatio !== null && a.whiteRatio < 0.4,
  ).length;
  const brokenUrls = audits.filter((a) => a.status === "error" || (typeof a.status === "number" && a.status >= 400)).length;

  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    imageCount: imgs.length,
    hero: audits[0] ?? null,
    images: audits,
    copilotsCount,
    copilotsWithoutWhite,
    brokenUrls,
  };
}

async function main() {
  const slugs = onlySlug ? [onlySlug] : BANK_SLUGS;
  if (SAMPLE) slugs.splice(3); // alleen eerste 3 voor snelle test

  const results: ProductAudit[] = [];
  for (const slug of slugs) {
    process.stderr.write(`· ${slug}\n`);
    const a = await auditProduct(slug);
    if (a) results.push(a);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Compact rapport
  console.log(`\n═══ Audit rapport ═══\n`);
  console.log(`Producten: ${results.length}\n`);

  // Sectie 1: foto's zonder witte bg
  const noWhite: { slug: string; url: string; whiteRatio: number; colors: string[] }[] = [];
  for (const r of results) {
    for (const i of r.images) {
      if (i.isCopilot && i.whiteRatio !== null && i.whiteRatio < 0.4) {
        noWhite.push({
          slug: r.slug,
          url: i.url.split("/upload/")[1] ?? i.url,
          whiteRatio: i.whiteRatio,
          colors: i.dominantColors ?? [],
        });
      }
    }
  }

  console.log(`─── Copilot foto's zonder witte achtergrond (${noWhite.length}) ───`);
  for (const x of noWhite) {
    console.log(`  ${x.slug}`);
    console.log(`    ${x.url}`);
    console.log(`    wit=${(x.whiteRatio * 100).toFixed(0)}%  top=${x.colors.join(" ")}`);
  }

  // Sectie 2: broken urls
  const broken: { slug: string; url: string; status: number | "error" }[] = [];
  for (const r of results) {
    for (const i of r.images) {
      if (i.status === "error" || (typeof i.status === "number" && i.status >= 400)) {
        broken.push({ slug: r.slug, url: i.url, status: i.status });
      }
    }
  }
  console.log(`\n─── Foto's die niet laden (${broken.length}) ───`);
  for (const x of broken) {
    console.log(`  ${x.slug}  [${x.status}]  ${x.url.split("/upload/")[1] ?? x.url}`);
  }

  // Sectie 3: naam vs folder check (alleen check op verkeerde inputs)
  console.log(`\n─── Namen vs categorie ───`);
  const totalImgs = results.reduce((s, r) => s + r.imageCount, 0);
  const totalCopilots = results.reduce((s, r) => s + r.copilotsCount, 0);
  const totalNoWhite = results.reduce((s, r) => s + r.copilotsWithoutWhite, 0);
  console.log(`  Producten: ${results.length}  ·  Foto's totaal: ${totalImgs}  ·  Copilots: ${totalCopilots}  ·  Zonder wit: ${totalNoWhite}\n`);

  for (const r of results) {
    const flag = r.brokenUrls > 0 ? "✗" : r.copilotsWithoutWhite > 0 ? "⚠" : "✓";
    console.log(`  ${flag} ${r.slug.padEnd(40)} cat=${r.category.padEnd(12)} #=${String(r.imageCount).padStart(2)}  copilots=${r.copilotsCount}  no-wit=${r.copilotsWithoutWhite}  broken=${r.brokenUrls}`);
  }

  // Save full report
  const reportPath = path.join(process.cwd(), "audit-bank-photos.json");
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Volledig rapport: ${reportPath}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
