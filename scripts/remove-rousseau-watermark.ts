// Verwijdert het "ROUSSEAU"-watermerk (rechtsonder) uit de Ray-serie foto's.
// Past Cloudinary generative-remove toe op een proportionele rechteronderhoek-
// regio, overschrijft de asset (bakt het in) en werkt de DB-URL's bij.
//
// Marc/Mike zijn schone CGI-renders → uitgesloten (alleen slugs met "ray").
//
// Dry-run:  npx tsx scripts/remove-rousseau-watermark.ts
// 1 product: npx tsx scripts/remove-rousseau-watermark.ts --apply --only=<slug>
// Alles:    npx tsx scripts/remove-rousseau-watermark.ts --apply

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const APPLY = process.argv.includes("--apply");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const SLUGS = process.argv.find((a) => a.startsWith("--slugs="))?.split("=")[1]?.split(",").filter(Boolean);

// Watermerk-regio als fractie van de afbeelding: rechtsonder 22,33% × 12,5%.
// Geverifieerd op box-watermerk, tekst-watermerk én maatschets (labels intact).
const RX = 0.7767, RY = 0.875, RW = 0.2233, RH = 0.125;

type Img = { url: string; w: number; h: number };

function publicIdFromUrl(url: string): string | null {
  const i = url.indexOf("/upload/");
  if (i < 0) return null;
  let rest = url.slice(i + "/upload/".length);
  rest = rest.replace(/^v\d+\//, ""); // versie strippen
  return rest.replace(/\.(jpe?g|png|webp)$/i, "");
}

function genRemoveUrl(publicId: string, w: number, h: number): string {
  const x = Math.round(w * RX), y = Math.round(h * RY);
  const rw = Math.round(w * RW), rh = Math.round(h * RH);
  const t = `e_gen_remove:region_(x_${x};y_${y};w_${rw};h_${rh})`;
  return `https://res.cloudinary.com/${CLOUD}/image/upload/${t}/${publicId}.jpg`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Generative-remove rendert async: eerste hits geven 423 "processing".
// Zelf ophalen tot een echte image terugkomt, dan pas overschrijven.
async function warmUntilReady(url: string, tries = 12): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 3000) return true;
      }
    } catch { /* retry */ }
    await sleep(4000);
  }
  return false;
}

async function uploadRetry(src: string, pid: string, tries = 3) {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await cloudinary.uploader.upload(src, {
        public_id: pid, overwrite: true, invalidate: true, resource_type: "image",
      });
    } catch (e) {
      last = e;
      await sleep(5000);
    }
  }
  throw last;
}

async function main() {
  // Default: Ray-serie (slug bevat "ray"). Met --slugs of --only: exacte selectie
  // uit alle kledingkasten (bv. Mike-Sonoma varianten die ook watermerk bleken te hebben).
  const explicit = SLUGS ?? (ONLY ? [ONLY] : null);
  const products = await prisma.product.findMany({
    where: explicit
      ? { category: "kledingkasten", slug: { in: explicit }, deletedAt: null }
      : { category: "kledingkasten", slug: { contains: "ray" }, deletedAt: null },
    select: { id: true, slug: true, images: true },
    orderBy: { slug: "asc" },
  });
  const targets = products;

  let totalImgs = 0;
  for (const p of targets) totalImgs += (JSON.parse(p.images) as Img[]).length;
  console.log(`\n═══ ROUSSEAU-watermerk verwijderen — ${targets.length} Ray-producten, ${totalImgs} foto's ═══`);
  console.log(APPLY ? "MODE: APPLY (overschrijft assets + DB)\n" : "MODE: dry-run\n");

  if (!APPLY) {
    for (const p of targets) {
      const imgs = JSON.parse(p.images) as Img[];
      console.log(`  ${p.slug.padEnd(42)} ${imgs.length} foto's  (${imgs[0]?.w}×${imgs[0]?.h})`);
    }
    console.log("\nDry-run. Run met --apply.");
    await prisma.$disconnect();
    process.exit(0);
  }

  let done = 0, failed = 0;
  for (const p of targets) {
    const imgs = JSON.parse(p.images) as Img[];
    process.stdout.write(`\n🧽 ${p.slug} `);
    const updated: Img[] = [];
    for (const im of imgs) {
      const pid = publicIdFromUrl(im.url);
      if (!pid) { updated.push(im); process.stdout.write("?"); continue; }
      const src = genRemoveUrl(pid, im.w, im.h);
      try {
        await warmUntilReady(src);
        const r = await uploadRetry(src, pid);
        updated.push({ url: r!.secure_url, w: r!.width, h: r!.height });
        done++;
        process.stdout.write(".");
      } catch (e) {
        updated.push(im);
        failed++;
        process.stdout.write("x");
        const msg = e instanceof Error ? e.message
          : (e as { error?: { message?: string } })?.error?.message ?? JSON.stringify(e);
        console.error(`\n   ✗ ${pid}: ${msg}`);
      }
    }
    await prisma.product.update({ where: { id: p.id }, data: { images: JSON.stringify(updated) } });
    process.stdout.write(" ✓");
  }
  console.log(`\n\n✅ Klaar — ${done} foto's schoongemaakt, ${failed} mislukt.`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
