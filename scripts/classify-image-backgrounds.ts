/**
 * Bepaalt per productfoto of het een vrijstaande foto op een effen rand is
 * ("plain": wit/grijs studio) of een sfeerfoto ("scene": kamer, opstelling) en
 * schrijft dat als `bg` in Product.images. De shop gebruikt dat veld om het
 * kader te vullen zonder gekleurde band: plain → opvullen in de randkleur
 * (Cloudinary c_pad + b_auto, onzichtbaar), scene → slim bijsnijden (c_fill + g_auto).
 *
 * Werkwijze: per foto een 64px-versie ophalen bij Cloudinary en de buitenste
 * pixelring bekijken. Is ≥ 96% van die ring (bijna) dezelfde kleur, dan is de
 * rand effen → "plain". Anders "scene".
 *
 *   npx tsx scripts/classify-image-backgrounds.ts              # dry-run, alle producten (ook verborgen)
 *   npx tsx scripts/classify-image-backgrounds.ts --apply      # schrijft `bg` weg
 *   npx tsx scripts/classify-image-backgrounds.ts --force      # ook foto's die al een bg hebben
 *   npx tsx scripts/classify-image-backgrounds.ts --slug=x     # één product
 *   npx tsx scripts/classify-image-backgrounds.ts --limit=50   # eerste N producten
 *
 * Herhaalbaar: foto's met een bestaand `bg` worden overgeslagen (tenzij --force),
 * dus na een import alleen de nieuwe foto's. Andere sleutels in de JSON blijven staan.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import type { ImageBackground } from "../lib/imageHelpers";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0) || undefined;
const SLUG = args.find((a) => a.startsWith("--slug="))?.slice(7);

const THUMB_W = 64;
const RING = 2; // pixels
const TOLERANCE = 14; // per kanaal, t.o.v. de mediaan van de ring
const PLAIN_SHARE = 0.96;
const CONCURRENCY = 8;

type RawImage = Record<string, unknown>;

function thumbUrl(url: string): string | null {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return null;
  return url.replace("/upload/", `/upload/c_fit,w_${THUMB_W},f_jpg,q_70/`);
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** "plain" als de buitenste ring vrijwel één kleur heeft, anders "scene". */
function classifyPixels(data: Buffer, width: number, height: number, channels: number): ImageBackground {
  const px: number[][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onRing = y < RING || y >= height - RING || x < RING || x >= width - RING;
      if (!onRing) continue;
      const i = (y * width + x) * channels;
      px.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  if (px.length === 0) return "scene";
  const med = [0, 1, 2].map((c) => median(px.map((p) => p[c])));
  const near = px.filter((p) => p.every((v, c) => Math.abs(v - med[c]) <= TOLERANCE)).length;
  return near / px.length >= PLAIN_SHARE ? "plain" : "scene";
}

async function classify(url: string): Promise<ImageBackground | null> {
  const t = thumbUrl(url);
  if (!t) return null;
  const res = await fetch(t);
  if (!res.ok) {
    console.warn(`  ! ${res.status} ${t}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return classifyPixels(data, info.width, info.height, info.channels);
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null, ...(SLUG ? { slug: SLUG } : {}) },
    select: { id: true, slug: true, images: true },
    orderBy: { slug: "asc" },
    take: LIMIT,
  });
  const totals = { producten: products.length, fotos: 0, plain: 0, scene: 0, overgeslagen: 0, mislukt: 0, gewijzigd: 0 };
  const examples: Record<ImageBackground, string[]> = { plain: [], scene: [] };

  await pool(products, CONCURRENCY, async (p) => {
    let arr: unknown;
    try {
      arr = JSON.parse(p.images);
    } catch {
      return;
    }
    if (!Array.isArray(arr)) return;
    const images: RawImage[] = arr.map((item: unknown) => (typeof item === "string" ? { url: item } : (item as RawImage)));
    let changed = false;
    for (const img of images) {
      const url = typeof img.url === "string" ? img.url : typeof img.src === "string" ? img.src : "";
      if (!url) continue;
      totals.fotos++;
      if (!FORCE && (img.bg === "plain" || img.bg === "scene")) {
        totals.overgeslagen++;
        continue;
      }
      try {
        const bg = await classify(url);
        if (!bg) {
          totals.mislukt++;
          continue;
        }
        totals[bg]++;
        if (examples[bg].length < 8) examples[bg].push(`${p.slug}: ${url}`);
        if (img.bg !== bg) {
          img.bg = bg;
          changed = true;
        }
      } catch (err) {
        totals.mislukt++;
        console.warn(`  ! ${p.slug}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (!changed) return;
    totals.gewijzigd++;
    if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { images: JSON.stringify(images) } });
  });

  console.log(APPLY ? "TOEGEPAST" : "DRY-RUN (gebruik --apply om weg te schrijven)");
  console.log(totals);
  console.log("\nVoorbeelden plain:\n  " + examples.plain.join("\n  "));
  console.log("\nVoorbeelden scene:\n  " + examples.scene.join("\n  "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
