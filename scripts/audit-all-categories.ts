// Multi-categorie audit: zelfde checks als deep-audit-verlichting maar over
// ALLE categorieën, compact vergelijkbaar. Toont per categorie:
//   specs-completeness, boilerplate-descriptions, featured, placeholder-foto's,
//   foto's per product, colorName-gaps.

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

function parseSpecs(s: string | null): Record<string, string> {
  if (!s) return {};
  try {
    const o = JSON.parse(s);
    return typeof o === "object" && o ? o : {};
  } catch {
    return {};
  }
}

async function loadMeta() {
  const m = new Map<string, number>(); // publicId → bytes
  let cursor: string | undefined;
  do {
    const r = await cloudinary.api.resources({
      type: "upload", prefix: "mokka", max_results: 500, next_cursor: cursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const i of r.resources) m.set(i.public_id, i.bytes ?? 0);
    cursor = r.next_cursor;
  } while (cursor);
  return m;
}

// Detecteer boilerplate/template descriptions: identieke prefix bij ≥2 producten
function detectBoilerplate(descs: string[]): number {
  const prefixes = new Map<string, number>();
  for (const d of descs) {
    if (!d) continue;
    const key = d.slice(0, 60);
    prefixes.set(key, (prefixes.get(key) ?? 0) + 1);
  }
  // Aantal producten dat in een gedeelde-prefix groep zit (≥2)
  let count = 0;
  for (const [, n] of prefixes) if (n >= 2) count += n;
  return count;
}

async function main() {
  console.log("\n═══ Multi-categorie audit ═══\n");

  const products = await prisma.product.findMany({
    where: { deletedAt: null, hidden: false },
    select: {
      slug: true, name: true, description: true, specs: true,
      category: true, colorName: true, colorGroup: true,
      featured: true, images: true, price: true,
    },
  });
  const meta = await loadMeta();

  type Stats = {
    count: number;
    afmetingen: number; materiaal: number; kleurSpec: number;
    boilerplateDescs: number; noDesc: number;
    featured: number;
    placeholders: number; totalPhotos: number; onePhoto: number;
    colorGroupMembers: number; colorNameMissing: number;
    descsList: string[];
  };
  const byCat = new Map<string, Stats>();

  for (const p of products) {
    const s = byCat.get(p.category) ?? {
      count: 0, afmetingen: 0, materiaal: 0, kleurSpec: 0,
      boilerplateDescs: 0, noDesc: 0, featured: 0,
      placeholders: 0, totalPhotos: 0, onePhoto: 0,
      colorGroupMembers: 0, colorNameMissing: 0, descsList: [],
    };
    s.count++;
    const specs = parseSpecs(p.specs);
    if (specs.Afmetingen) s.afmetingen++;
    if (specs.Materiaal) s.materiaal++;
    if (specs.Kleur) s.kleurSpec++;
    if (!p.description || p.description.length < 20) s.noDesc++;
    s.descsList.push(p.description ?? "");
    if (p.featured) s.featured++;
    if (p.colorGroup) {
      s.colorGroupMembers++;
      if (!p.colorName || p.colorName === "?") s.colorNameMissing++;
    }
    const imgs = parseImages(p.images);
    s.totalPhotos += imgs.length;
    if (imgs.length === 1) s.onePhoto++;
    for (const img of imgs) {
      const pid = extractPublicId(img.url);
      if (pid) {
        const bytes = meta.get(pid);
        if (bytes !== undefined && bytes < 30 * 1024) s.placeholders++;
      }
    }
    byCat.set(p.category, s);
  }

  // Compute boilerplate per cat
  for (const s of byCat.values()) {
    s.boilerplateDescs = detectBoilerplate(s.descsList);
  }

  // Print vergelijkingstabel
  const cats = Array.from(byCat.entries()).sort((a, b) => b[1].count - a[1].count);
  const pct = (n: number, t: number) => t > 0 ? `${Math.round(n / t * 100)}%` : "—";

  console.log("CATEGORIE        N    MATR  AFM   KLR   BOILER  NODESC  FEAT  PLACEH  1-FOTO  COLOR?");
  console.log("─".repeat(95));
  for (const [cat, s] of cats) {
    console.log(
      `  ${cat.padEnd(15)} ${s.count.toString().padStart(3)}  ${pct(s.materiaal, s.count).padStart(4)}  ${pct(s.afmetingen, s.count).padStart(4)}  ${pct(s.kleurSpec, s.count).padStart(4)}  ${s.boilerplateDescs.toString().padStart(6)}  ${s.noDesc.toString().padStart(6)}  ${s.featured.toString().padStart(4)}  ${s.placeholders.toString().padStart(6)}  ${s.onePhoto.toString().padStart(6)}  ${s.colorNameMissing.toString().padStart(6)}`,
    );
  }
  console.log("\nLegend: MATR=Materiaal% AFM=Afmetingen% KLR=Kleur-spec% BOILER=boilerplate-desc count");
  console.log("        NODESC=lege desc FEAT=featured PLACEH=placeholder-foto's 1-FOTO=single-photo COLOR?=missing colorName");

  // Probleem-prioritering
  console.log("\n─── Prioriteit: categorieën met meeste problemen ───");
  type Issue = { cat: string; score: number; issues: string[] };
  const ranked: Issue[] = [];
  for (const [cat, s] of cats) {
    const issues: string[] = [];
    let score = 0;
    if (s.materiaal < s.count * 0.5) { issues.push(`materiaal ${pct(s.materiaal, s.count)}`); score += (s.count - s.materiaal); }
    if (s.afmetingen < s.count * 0.5) { issues.push(`afmetingen ${pct(s.afmetingen, s.count)}`); score += (s.count - s.afmetingen) * 0.5; }
    if (s.boilerplateDescs > 0) { issues.push(`${s.boilerplateDescs} boilerplate-desc`); score += s.boilerplateDescs; }
    if (s.noDesc > 0) { issues.push(`${s.noDesc} lege desc`); score += s.noDesc * 2; }
    if (s.placeholders > 0) { issues.push(`${s.placeholders} placeholder-foto`); score += s.placeholders * 3; }
    if (s.colorNameMissing > 0) { issues.push(`${s.colorNameMissing} missing colorName`); score += s.colorNameMissing * 2; }
    if (issues.length > 0) ranked.push({ cat, score, issues });
  }
  ranked.sort((a, b) => b.score - a.score);
  for (const r of ranked) {
    console.log(`\n  [${r.cat}] (score ${Math.round(r.score)})`);
    for (const i of r.issues) console.log(`    - ${i}`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
