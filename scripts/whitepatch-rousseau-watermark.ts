// Legt een egaal achtergrond-kleur vlak over de badge-hoek van de maatschets-
// foto's (witte achtergrond) waar gen-remove nog een vage tekst-rest liet.
// Alleen toegepast als de hoek écht egaal/wit is (geen product- of maatlijn-
// pixels). De vulkleur wordt net bóven de badge bemonsterd → naadloos.
//
// Werkt op de 78 foto's uit rousseau-wm-flagged.json (de eerder schoongemaakte).
//
// Dry-run: npx tsx scripts/whitepatch-rousseau-watermark.ts
// Apply:   npx tsx scripts/whitepatch-rousseau-watermark.ts --apply

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { readFileSync } from "node:fs";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const TMP = "C:/Users/konia/AppData/Local/Temp";

// Patch-rechthoek (fractie): dekt de gen-remove regio rechtsonder ruim af.
const PX = 0.74, PY = 0.84; // start (links-boven van patch)
// Bemonster-strip net bóven de patch (zelfde x-band), om de achtergrondkleur te pakken.
const SY0 = 0.66, SY1 = 0.82;

type Img = { url: string; w: number; h: number };
type Flag = { pid: string; idx: number };

function publicIdFromUrl(url: string): string | null {
  const i = url.indexOf("/upload/");
  if (i < 0) return null;
  return url.slice(i + "/upload/".length).replace(/^v\d+\//, "").replace(/\.(jpe?g|png|webp)$/i, "");
}

// Analyseer de badge-hoek + bemonster achtergrond. Geeft beslissing + vulkleur.
async function inspect(full: Buffer, W: number, H: number) {
  const { data, info } = await sharp(full).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels, iw = info.width, ih = info.height;
  const at = (x: number, y: number) => { const i = (y * iw + x) * ch; return [data[i], data[i + 1], data[i + 2]] as const; };

  // 1) badge-hoek: aandeel donker (product/lijn) — als er donker zit: NIET patchen
  let dark = 0, cn = 0;
  for (let y = Math.floor(PY * ih); y < ih; y++) for (let x = Math.floor(PX * iw); x < iw; x++) {
    const [r, g, b] = at(x, y); cn++; if ((r + g + b) / 3 < 110) dark++;
  }
  const darkPct = dark / cn * 100;

  // 2) bemonster-strip: kleur + uniformiteit
  const sx0 = Math.floor(PX * iw), sy0 = Math.floor(SY0 * ih), sy1 = Math.floor(SY1 * ih);
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let y = sy0; y < sy1; y++) for (let x = sx0; x < iw; x++) { const [r, g, b] = at(x, y); rs.push(r); gs.push(g); bs.push(b); }
  const med = (a: number[]) => { a.sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
  const mr = med([...rs]), mg = med([...gs]), mb = med([...bs]);
  // uniformiteit: % pixels binnen ±10 van de mediaan-helderheid
  const mbr = (mr + mg + mb) / 3;
  let near = 0; for (let k = 0; k < rs.length; k++) { const br = (rs[k] + gs[k] + bs[k]) / 3; if (Math.abs(br - mbr) < 12) near++; }
  const uniformPct = near / rs.length * 100;

  const whiteBg = mbr > 232 && uniformPct > 90 && darkPct < 1.0;
  return { whiteBg, fill: { r: mr, g: mg, b: mb }, darkPct, mbr, uniformPct };
}

async function main() {
  const flags: Flag[] = JSON.parse(readFileSync(`${TMP}/rousseau-wm-flagged.json`, "utf8"));
  const byProd = new Map<string, Set<number>>();
  for (const f of flags) (byProd.get(f.pid) ?? byProd.set(f.pid, new Set()).get(f.pid)!).add(f.idx);

  let patch = 0, skip = 0;
  const log: string[] = [];
  for (const [pid, idxs] of byProd) {
    const p = await prisma.product.findUnique({ where: { id: pid }, select: { slug: true, images: true } });
    if (!p) continue;
    const imgs: Img[] = JSON.parse(p.images);
    let changed = false;
    for (const idx of idxs) {
      const im = imgs[idx]; if (!im) continue;
      const cldId = publicIdFromUrl(im.url); if (!cldId) continue;
      const res = await fetch(im.url); const full = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(full).metadata();
      const W = meta.width!, H = meta.height!;
      const v = await inspect(full, W, H);
      if (!v.whiteBg) { skip++; log.push(`  -  skip  ${p.slug} [${idx}]  (bg=${v.mbr.toFixed(0)} uni=${v.uniformPct.toFixed(0)}% dark=${v.darkPct.toFixed(1)}%)`); continue; }
      patch++;
      log.push(`  ✓ patch  ${p.slug} [${idx}]  vul rgb(${v.fill.r},${v.fill.g},${v.fill.b})`);
      if (APPLY) {
        const px = Math.floor(PX * W), py = Math.floor(PY * H);
        const rect = await sharp({ create: { width: W - px, height: H - py, channels: 3, background: v.fill } }).png().toBuffer();
        const out = await sharp(full).composite([{ input: rect, left: px, top: py }]).jpeg({ quality: 90 }).toBuffer();
        const up = await cloudinary.uploader.upload(`data:image/jpeg;base64,${out.toString("base64")}`, { public_id: cldId, overwrite: true, invalidate: true });
        imgs[idx] = { url: up.secure_url, w: up.width, h: up.height };
        changed = true;
      }
    }
    if (APPLY && changed) await prisma.product.update({ where: { id: pid }, data: { images: JSON.stringify(imgs) } });
  }
  console.log(log.join("\n"));
  console.log(`\nWit-vlak: ${patch} foto's,  overgeslagen (textuur/niet-wit): ${skip}.`);
  console.log(APPLY ? "✅ Toegepast." : "(DRY-RUN — run met --apply)");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
