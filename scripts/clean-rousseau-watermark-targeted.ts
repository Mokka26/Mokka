// Verwijdert het ROUSSEAU-badge ALLEEN op de foto's uit de detectie-scan
// (scripts/scan-rousseau-watermark.ts → rousseau-wm-flagged.json).
// Cloudinary generative-remove op de badge-regio rechtsonder, bakt het in
// (overschrijft de asset) en werkt de DB-URL's bij.
//
// Test 1:  npx tsx scripts/clean-rousseau-watermark-targeted.ts --apply --limit=1
// Alles:   npx tsx scripts/clean-rousseau-watermark-targeted.ts --apply

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const APPLY = process.argv.includes("--apply");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const TMP = "C:/Users/konia/AppData/Local/Temp";

// Zelfde regio als detectie + remove-rousseau-watermark.ts (rechtsonder).
const RX = 0.73, RY = 0.845, RW = 0.27, RH = 0.155;
type Img = { url: string; w: number; h: number };
type Flag = { pid: string; idx: number; url: string };

function publicIdFromUrl(url: string): string | null {
  const i = url.indexOf("/upload/");
  if (i < 0) return null;
  let rest = url.slice(i + "/upload/".length);
  rest = rest.replace(/^v\d+\//, "");
  return rest.replace(/\.(jpe?g|png|webp)$/i, "");
}
function genRemoveUrl(publicId: string, w: number, h: number): string {
  const x = Math.round(w * RX), y = Math.round(h * RY);
  const rw = Math.round(w * RW), rh = Math.round(h * RH);
  return `https://res.cloudinary.com/${CLOUD}/image/upload/e_gen_remove:region_(x_${x};y_${y};w_${rw};h_${rh})/${publicId}.jpg`;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function warmUntilReady(url: string, tries = 12): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try { const res = await fetch(url); if (res.ok && (await res.arrayBuffer()).byteLength > 3000) return true; } catch { /* */ }
    await sleep(4000);
  }
  return false;
}
async function uploadRetry(src: string, pid: string, tries = 3) {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await cloudinary.uploader.upload(src, { public_id: pid, overwrite: true, invalidate: true, resource_type: "image" }); }
    catch (e) { last = e; await sleep(5000); }
  }
  throw last;
}

async function main() {
  let flags: Flag[] = JSON.parse(readFileSync(`${TMP}/rousseau-wm-flagged.json`, "utf8"));
  if (LIMIT > 0) flags = flags.slice(0, LIMIT);

  const byProd = new Map<string, Set<number>>();
  for (const f of flags) (byProd.get(f.pid) ?? byProd.set(f.pid, new Set()).get(f.pid)!).add(f.idx);

  console.log(`\n═══ Gerichte ROUSSEAU-watermerk-verwijdering ═══`);
  console.log(`Foto's: ${flags.length} over ${byProd.size} producten.`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run (geen wijzigingen)\n");
  if (!APPLY) { await prisma.$disconnect(); return; }

  let ok = 0, fail = 0;
  for (const [pid, idxs] of byProd) {
    const p = await prisma.product.findUnique({ where: { id: pid }, select: { slug: true, images: true } });
    if (!p) continue;
    const imgs: Img[] = JSON.parse(p.images);
    for (const idx of idxs) {
      const im = imgs[idx];
      const cldId = im && publicIdFromUrl(im.url);
      if (!im || !cldId) { fail++; continue; }
      const src = genRemoveUrl(cldId, im.w, im.h);
      try {
        await warmUntilReady(src);
        const r = await uploadRetry(src, cldId);
        imgs[idx] = { url: r!.secure_url, w: r!.width, h: r!.height };
        ok++;
        console.log(`  ✓ ${p.slug} [img ${idx}]`);
      } catch (e) {
        fail++;
        console.error(`  ✗ ${p.slug} [img ${idx}]: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
      }
    }
    await prisma.product.update({ where: { id: pid }, data: { images: JSON.stringify(imgs) } });
  }
  console.log(`\n✅ Klaar — ${ok} foto's schoongemaakt, ${fail} mislukt.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
