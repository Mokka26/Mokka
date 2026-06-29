// SCAN (geen wijzigingen): detecteert welke Rousseau-foto's het ROUSSEAU-badge
// rechtsonder hebben. Meet in de badge-regio het aandeel donkere pixels (badge-
// achtergrond) + witte pixels (de tekst). Schone hoeken zijn ~100% wit.
//
// Output: tellingen + een flagged-lijst (JSON) voor de opschoonstap + montages
// (PNG) om handmatig vals-positieven/negatieven te checken.
//
// Run: npx tsx scripts/scan-rousseau-watermark.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();
const CROP = "c_crop,g_south_east,w_0.2233,h_0.125,fl_relative/w_240";
const TMP = "C:/Users/konia/AppData/Local/Temp";
const CONCURRENCY = 8;
// drempels (geijkt op bekende samples: schoon dark~0%, watermerk dark 7-13%)
const DARK_T = 2, WHITE_T = 8;

type Img = { url: string; w: number; h: number };
type Task = { pid: string; slug: string; idx: number; url: string };

function cropUrl(u: string) { return u.replace("/upload/", `/upload/${CROP}/`); }

async function pMap<T, R>(items: T[], fn: (x: T, i: number) => Promise<R>, limit: number): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0;
  async function w() { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, w));
  return out;
}

async function analyze(url: string): Promise<{ navy: number; textInBox: number; buf: Buffer } | null> {
  try {
    const res = await fetch(cropUrl(url));
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 200) return null;
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels, W = info.width, H = info.height; const n = W * H;
    let navy = 0, minX = W, maxX = -1, minY = H, maxY = -1;
    const isNavy = (i: number) => {
      const r = data[i], g = data[i + 1], b = data[i + 2]; const br = (r + g + b) / 3;
      return br > 25 && br < 120 && b - r > 14 && b - g > 6;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      if (isNavy(i)) { navy++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    // Binnen de navy-bounding-box: aandeel heldere pixels (= witte tekst).
    // Badge = navy blok mét witte letters → veel; massieve poot → bijna niets.
    let bright = 0, boxN = 0;
    if (maxX >= minX) {
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const i = (y * W + x) * ch; const br = (data[i] + data[i + 1] + data[i + 2]) / 3;
        boxN++; if (br > 165) bright++;
      }
    }
    return { navy: navy / n * 100, textInBox: boxN ? bright / boxN * 100 : 0, buf };
  } catch { return null; }
}

async function montage(bufs: Buffer[], cols: number, file: string) {
  if (!bufs.length) return;
  const cw = 200, chh = 80;
  const tiles = await Promise.all(bufs.map((b) => sharp(b).resize(cw, chh, { fit: "contain", background: "#dddddd" }).toBuffer()));
  const rows = Math.ceil(tiles.length / cols);
  const canvas = sharp({ create: { width: cols * cw, height: rows * chh, channels: 3, background: "#999999" } });
  const comp = tiles.map((input, i) => ({ input, left: (i % cols) * cw, top: Math.floor(i / cols) * chh }));
  await canvas.composite(comp).png().toFile(file);
}

async function main() {
  const products = await prisma.product.findMany({
    where: { source: "Rousseau", deletedAt: null },
    select: { id: true, slug: true, images: true }, orderBy: { slug: "asc" },
  });
  const tasks: Task[] = [];
  for (const p of products) {
    let imgs: Img[] = []; try { imgs = JSON.parse(p.images); } catch { /* */ }
    imgs.forEach((im, idx) => tasks.push({ pid: p.id, slug: p.slug, idx, url: im.url }));
  }
  console.log(`\nScan: ${products.length} producten, ${tasks.length} foto's. Detecteren…\n`);

  const NAVY_T = 2.0, TEXT_T = 6.0; // badge: navy-blok + witte tekst erin
  const hits: { t: Task; navy: number; text: number; buf: Buffer }[] = [];
  let scanned = 0, failed = 0;
  await pMap(tasks, async (t) => {
    const a = await analyze(t.url);
    scanned++;
    if (!a) { failed++; return; }
    if (a.navy > NAVY_T && a.textInBox > TEXT_T) hits.push({ t, navy: a.navy, text: a.textInBox, buf: a.buf });
  }, CONCURRENCY);
  hits.sort((x, y) => x.text - y.text); // oplopend op tekst%: minst-badge-achtig vooraan
  const flagged: Task[] = hits.map((h) => h.t);
  const flaggedBufs: Buffer[] = hits.slice(0, 60).map((h) => h.buf);
  const edgeBufs: Buffer[] = [];

  // per product samenvatten
  const perProd = new Map<string, number>();
  for (const f of flagged) perProd.set(f.slug, (perProd.get(f.slug) ?? 0) + 1);

  console.log("\nLaagste 24 hits (tekst% in navy-box — controle vals-positieven):");
  hits.slice(0, 24).forEach((h, i) => console.log(`  #${String(i).padStart(2)} navy=${h.navy.toFixed(1).padStart(5)} tekst=${h.text.toFixed(1).padStart(5)}  ${h.t.slug} [img ${h.t.idx}]`));
  console.log(`\nGescand: ${scanned}  (fetch-fouten: ${failed})`);
  console.log(`Watermerk-foto's gevonden: ${flagged.length}  over ${perProd.size} producten\n`);
  console.log("Top producten met watermerk-foto's:");
  [...perProd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([s, n]) => console.log(`  ${n}×  ${s}`));

  writeFileSync(`${TMP}/rousseau-wm-flagged.json`, JSON.stringify(flagged.map((f) => ({ pid: f.pid, idx: f.idx, url: f.url })), null, 0));
  await montage(flaggedBufs, 6, `${TMP}/wm-flagged-montage.png`);
  await montage(edgeBufs, 6, `${TMP}/wm-edge-montage.png`);
  console.log(`\nFlagged-lijst: ${TMP}/rousseau-wm-flagged.json`);
  console.log(`Montage (gevlagd):   ${TMP}/wm-flagged-montage.png`);
  console.log(`Montage (grensgeval): ${TMP}/wm-edge-montage.png`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
