// Kleurbolletjes uit de eigen productfoto i.p.v. een vaste kleur per kleurwoord.
// Per product: vrijstaande foto (bg "plain", anders de eerste), achtergrond
// weg, bovenste 65% van het product (zitting/rug, tafelblad — geen poten),
// k-means → grootste cluster, lichtere helft (minder schaduw).
//
//   npx tsx --env-file=.env.local scripts/swatch-colors-from-photos.ts <proposal.json> <outdir>
//
// Read-only voor de database. Schrijft <outdir>/swatches.json ({id: "#RRGGBB"})
// en vergelijkingsbladen <outdir>/sheet-NN.png (foto + oud/nieuw bolletje).
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseImages } from "@/lib/imageHelpers";

const db = new PrismaClient();
const [FILE, OUT] = process.argv.slice(2);

type RGB = [number, number, number];
interface Proposal {
  model: string;
  category: string;
  items: { id: string; name: string; colorName: string | null; sizeName: string | null }[];
}
const TABLES = new Set(["eettafels", "salontafels", "bijzettafels"]);

function lab([r, g, b]: RGB): RGB {
  const f = (v: number) => { const c = v / 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))];
}
const dE = (a: RGB, b: RGB) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const toHex = (c: RGB) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const lum = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Smalle versie van de Cloudinary-URL (sneller downloaden). */
const small = (url: string) => url.replace("/upload/", "/upload/w_300,c_limit/");

/**
 * @param topShare deel van het product (van boven) dat telt: stoelen 0.65
 *   (zitting + rug), tafels 0.15 (alleen het blad, niet het onderstel).
 * Geeft null als de foto geen egale achtergrond heeft (sfeerfoto).
 */
/** Hoofdkleur (lichtere helft van het grootste k-means-cluster). */
function dominant(pts: RGB[]): RGB {
  let cent: RGB[] = [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map((c) => [...c] as RGB);
  let assign: number[] = [];
  for (let it = 0; it < 12; it++) {
    assign = pts.map((p) => {
      let best = 0, bd = Infinity;
      cent.forEach((c, k) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = k; } });
      return best;
    });
    cent = cent.map((c, k) => {
      const m = pts.filter((_, i) => assign[i] === k);
      return m.length ? ([0, 1, 2].map((j) => m.reduce((s, p) => s + p[j], 0) / m.length) as RGB) : c;
    });
  }
  const counts = cent.map((_, k) => assign.filter((a) => a === k).length);
  const main = counts.indexOf(Math.max(...counts));
  // Lichtere helft: schaduw trekt het gemiddelde anders te donker.
  const members = pts.filter((_, i) => assign[i] === main).sort((a, b) => lum(a) - lum(b));
  const upper = members.slice(Math.floor(members.length / 2));
  return [0, 1, 2].map((j) => upper.reduce((s, p) => s + p[j], 0) / upper.length) as RGB;
}

async function photoColor(buf: Buffer, topShare: number): Promise<{ top: RGB; base: RGB | null } | null> {
  const { data, info } = await sharp(buf).removeAlpha().resize(200, 200, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const px = (x: number, y: number): RGB => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  // Bovenhoeken + linksonder: Rousseau-foto's hebben rechtsonder een grijze balk.
  const corners = [px(1, 1), px(W - 2, 1), px(1, H - 2)];
  // Vrijstaand = deze hoeken (vrijwel) dezelfde, lichte kleur.
  const plain = corners.every((c) => corners.every((d) => dE(c, d) < 10)) && corners.every((c) => lum(c) > 200);
  if (!plain) return null;
  const bg = [0, 1, 2].map((k) => corners.reduce((s, c) => s + c[k], 0) / corners.length) as RGB;
  const fg: { x: number; y: number; p: RGB }[] = []; // voorgrond (product)
  let minY = H, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x > W * 0.7 && y > H * 0.85) continue; // balk rechtsonder
      const p = px(x, y);
      if (dE(p, bg) <= 12) continue;
      fg.push({ x, y, p });
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (fg.length < 50) return null;
  const cut = minY + (maxY - minY) * topShare;
  let topPts = fg.filter((f) => f.y <= cut).map((f) => f.p);
  // Wit/crème blad op witte achtergrond valt weg: dan telt het bovenste deel
  // vooral poten. Bij weinig voorgrond in die band: de bijna-achtergrond-
  // pixels (ΔE 2–12) binnen de productbreedte zijn het blad.
  const xs = fg.map((f) => f.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const band = (maxX - minX + 1) * (cut - minY + 1);
  if (topPts.length < band * 0.3) {
    const pale: RGB[] = [];
    for (let y = minY; y <= cut; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p = px(x, y);
        const d = dE(p, bg);
        if (d > 2 && d <= 12) pale.push(p);
      }
    }
    if (pale.length > topPts.length) topPts = pale;
  }
  // Onderstel: onderste 30% van het product (poten / voet).
  const baseCut = minY + (maxY - minY) * 0.7;
  const basePts = fg.filter((f) => f.y >= baseCut).map((f) => f.p);
  return { top: dominant(topPts), base: basePts.length >= 20 ? dominant(basePts) : null };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

(async () => {
  if (!FILE || !OUT) throw new Error("Gebruik: <proposal.json> <outdir>");
  mkdirSync(OUT, { recursive: true });
  const groups = JSON.parse(readFileSync(FILE, "utf8")) as Proposal[];
  // Alleen modellen met ≥ 2 kleuren tonen bolletjes.
  const items = groups.flatMap((g) => {
    const colours = new Set(g.items.map((i) => (i.colorName ?? "").toLowerCase()).filter(Boolean));
    return colours.size > 1 ? g.items.map((i) => ({ ...i, model: g.model, topShare: TABLES.has(g.category) ? 0.15 : 0.65 })) : [];
  });
  const rows = await db.product.findMany({ where: { id: { in: items.map((i) => i.id) } }, select: { id: true, images: true, colorHex: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const measured = new Map<string, { top: RGB; base: RGB | null }>();
  const noPlain: string[] = [];
  const tiles: { id: string; img: Buffer; label: string; oldHex: string | null }[] = [];
  for (const [n, it] of items.entries()) {
    const row = byId.get(it.id);
    const imgs = parseImages(row?.images);
    // Vrijstaande foto's eerst (bg "plain"), daarna de rest; de eerste met
    // een egale achtergrond telt (max. 4 proberen).
    const candidates = [...imgs.filter((i) => i.bg === "plain"), ...imgs.filter((i) => i.bg !== "plain")].slice(0, 4);
    let thumbSrc: Buffer | null = null;
    try {
      for (const c of candidates) {
        const buf = Buffer.from(await (await fetch(small(c.url))).arrayBuffer());
        thumbSrc ??= buf;
        const col = await photoColor(buf, it.topShare);
        if (col) { measured.set(it.id, col); thumbSrc = buf; break; }
      }
      if (!measured.has(it.id)) noPlain.push(it.name);
      if (thumbSrc) {
        const thumb = await sharp(thumbSrc).resize(200, 200, { fit: "contain", background: "#fff" }).png().toBuffer();
        tiles.push({ id: it.id, img: thumb, label: `${it.model} · ${it.colorName ?? "—"}`, oldHex: row?.colorHex ?? null });
      }
    } catch (e: unknown) {
      console.warn(`  ${it.name}: ${e instanceof Error ? e.message : e}`);
    }
    if ((n + 1) % 100 === 0) console.log(`  ${n + 1}/${items.length}`);
  }

  // Tweekleurig (stof/onderstel) alleen waar nodig: als binnen hetzelfde model
  // en dezelfde maat twee kleuren op het hoofddeel niet te onderscheiden zijn
  // (ΔE < 10) maar wel een ander onderstel hebben. Dan het hele model
  // tweekleurig, zodat de rij consistent is.
  const swatches: Record<string, string> = {};
  const conflicts: string[] = [];
  const conflictIds = new Map<string, string>(); // id → gemeten kleur (niet gebruikt)
  for (const g of groups) {
    const members = g.items.filter((i) => measured.has(i.id));
    const bySize = new Map<string, typeof members>();
    for (const m of members) {
      const k = (m.sizeName ?? "").toLowerCase();
      bySize.set(k, [...(bySize.get(k) ?? []), m]);
    }
    let twoTone = false;
    for (const list of bySize.values()) {
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          const A = measured.get(list[a].id)!, B = measured.get(list[b].id)!;
          if (dE(A.top, B.top) < 10 && A.base && B.base && dE(A.base, B.base) >= 15) twoTone = true;
        }
      }
    }
    // Alleen stoelen: bij tafels zegt het onderstel niets over de gekozen uitvoering.
    if (TABLES.has(g.category)) twoTone = false;
    for (const m of members) {
      const c = measured.get(m.id)!;
      // Controle tegen het kleurwoord: "zwart" maar licht gemeten (of "wit"
      // maar donker) → foto is onbruikbaar (bv. maattekening); niet gebruiken.
      const L = lab(c.top)[0];
      const name = (m.colorName ?? "").toLowerCase();
      const firstWord = name.split(/[\s,/]+/)[0];
      if ((/\bzwart\b/.test(firstWord) && L > 55) || (/\bwit\b/.test(firstWord) && L < 45)) {
        conflicts.push(`${m.name}: gemeten ${toHex(c.top)} past niet bij "${m.colorName}"`);
        conflictIds.set(m.id, toHex(c.top));
        continue;
      }
      swatches[m.id] = twoTone && c.base ? `${toHex(c.top)}/${toHex(c.base)}` : toHex(c.top);
    }
  }
  writeFileSync(join(OUT, "swatches.json"), JSON.stringify(swatches, null, 1));
  writeFileSync(join(OUT, "conflicten.txt"), conflicts.join("\n"));
  const twoToneCount = Object.values(swatches).filter((v) => v.includes("/")).length;
  console.log(`${twoToneCount} producten tweekleurig (stof/onderstel); ${conflicts.length} conflicten met kleurnaam → conflicten.txt`);
  writeFileSync(join(OUT, "geen-vrijstaande-foto.txt"), noPlain.join("\n"));
  console.log(`${noPlain.length} producten zonder vrijstaande foto (kleur niet gemeten) → geen-vrijstaande-foto.txt`);

  // Vergelijkingsbladen: 6 × 5 tegels per blad; conflicten apart (gemeten kleur getoond).
  const W = 220, H = 280, COLS = 6, PER = 30;
  const conflictTiles = tiles.filter((t) => conflictIds.has(t.id));
  for (const t of conflictTiles) swatches[t.id] = conflictIds.get(t.id)!;
  const sheets: { name: string; list: typeof tiles }[] = [];
  for (let s = 0; s * PER < tiles.length; s++) sheets.push({ name: `sheet-${String(s + 1).padStart(2, "0")}.png`, list: tiles.slice(s * PER, s * PER + PER) });
  if (conflictTiles.length) sheets.push({ name: "conflicten.png", list: conflictTiles });
  for (const { name: file, list: page } of sheets) {
    const comp = page.flatMap((t, i) => {
      const left = (i % COLS) * W, top = Math.floor(i / COLS) * H;
      const [n1, n2] = (swatches[t.id] ?? "#FFFFFF").split("/");
      // Tweekleurig: diagonaal gedeeld zoals op de site (linksboven stof, rechtsonder onderstel).
      const newSwatch = n2
        ? `<clipPath id="c"><circle cx="60" cy="22" r="16"/></clipPath><g clip-path="url(#c)"><rect x="44" y="6" width="32" height="32" fill="${n2}"/><path d="M44 6 L76 6 L44 38 Z" fill="${n1}"/></g><circle cx="60" cy="22" r="16" fill="none" stroke="#333" stroke-width="2"/>`
        : `<circle cx="60" cy="22" r="16" fill="${n1}" stroke="#333" stroke-width="2"/>`;
      const oldFirst = (t.oldHex ?? "#FFFFFF").split("/")[0];
      const svg = Buffer.from(`<svg width="${W}" height="70" xmlns="http://www.w3.org/2000/svg">
<circle cx="22" cy="22" r="16" fill="${oldFirst}" stroke="#999"/>${newSwatch}
<text x="84" y="20" font-size="11" font-family="Arial" fill="#555">oud / nieuw</text>
<text x="6" y="56" font-size="12" font-family="Arial">${esc(t.label.slice(0, 32))}</text></svg>`);
      return [{ input: t.img, left: left + 10, top: top + 4 }, { input: svg, left, top: top + 206 }];
    });
    await sharp({ create: { width: COLS * W, height: Math.ceil(page.length / COLS) * H, channels: 3, background: "#ffffff" } })
      .composite(comp)
      .png()
      .toFile(join(OUT, file));
  }
  console.log(`${Object.keys(swatches).length} kleuren berekend; ${Math.ceil(tiles.length / PER)} bladen in ${OUT}`);
  await db.$disconnect();
})().catch(async (e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  await db.$disconnect();
  process.exit(1);
});
