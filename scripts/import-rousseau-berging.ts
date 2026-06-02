// Import Rousseau berging — schoenenkasten + kapstokken (dealer-assortiment).
// Zelfde aanpak als de bedden/kledingkasten-import: detailpagina parsen →
// foto's @2000px naar Cloudinary → VERBORGEN producten (prijs €0, source
// 'Rousseau'). Kleuren binnen één model = varianten via colorGroup.
//
// Dry-run:  npx tsx scripts/import-rousseau-berging.ts
// Apply:    npx tsx scripts/import-rousseau-berging.ts --apply

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
const APPLY = process.argv.includes("--apply");
const BASE = "https://www.rousseau.be";

const COLOR_HEX: Record<string, string> = {
  Sonoma: "#C9A876",
  Wit: "#F5F5F0",
  "Mat zwart": "#1C1C1C",
  Zwart: "#1C1C1C",
  Groen: "#3F5E47",
  Rood: "#8E3B36",
};
const COLOR_SLUG: Record<string, string> = {
  Sonoma: "sonoma",
  Wit: "wit",
  "Mat zwart": "mat-zwart",
  Zwart: "zwart",
  Groen: "groen",
  Rood: "rood",
};

type Cat = "schoenenkasten" | "kapstokken";
type Item = {
  sku: string;
  cat: Cat;
  slug: string;
  name: string;
  serie: string;
  color: string;
  materiaal: string;
  group: string | null; // colorGroup — alleen waar echte kleurvarianten bestaan
};

const SCHOEN_MAT = "Spaanderplaat met MDF-fronten";
const KAPSTOK_MAT = "Beukenhout & metaal";

// name = expliciete Rousseau-listingnaam (betrouwbaarder dan de detailpagina
// parsen — badges verstoren de naamregel). group = serie+uitvoering, alleen
// gezet waar meerdere kleuren bestaan.
const ITEMS: Item[] = [
  // ── Schoenenkasten ──
  { sku: "5230-2", cat: "schoenenkasten", slug: "schoenenkast-mex-spiegel-3-laden-sonoma",  name: "Schoenenkast 'Mex' Spiegel 3 laden Sonoma",       serie: "Mex",     color: "Sonoma", materiaal: SCHOEN_MAT, group: null },
  { sku: "5231-2", cat: "schoenenkasten", slug: "schoenenkast-mex-spiegel-4-laden-sonoma",  name: "Schoenenkast 'Mex' Spiegel 4 laden Sonoma",       serie: "Mex",     color: "Sonoma", materiaal: SCHOEN_MAT, group: null },
  { sku: "5232-2", cat: "schoenenkasten", slug: "schoenenkast-marcel-4-laden-spiegeldeur-sonoma", name: "Schoenenkast 'Marcel' 4 laden en 1 spiegeldeur Sonoma", serie: "Marcel", color: "Sonoma", materiaal: SCHOEN_MAT, group: null },
  { sku: "5233-2", cat: "schoenenkasten", slug: "schoenenkast-maurice-2-deuren-sonoma",     name: "Schoenenkast 'Maurice' 2 deuren Sonoma",          serie: "Maurice", color: "Sonoma", materiaal: SCHOEN_MAT, group: null },
  { sku: "5220-1", cat: "schoenenkasten", slug: "schoenenkast-mike-2-deuren-wit",           name: "Schoenenkast 'Mike' 2 deuren Wit",                serie: "Mike",    color: "Wit",    materiaal: SCHOEN_MAT, group: "schoenenkast-mike-2-deuren" },
  { sku: "5220-2", cat: "schoenenkasten", slug: "schoenenkast-mike-2-deuren-sonoma",        name: "Schoenenkast 'Mike' 2 deuren Sonoma",             serie: "Mike",    color: "Sonoma", materiaal: SCHOEN_MAT, group: "schoenenkast-mike-2-deuren" },
  { sku: "5202-1", cat: "schoenenkasten", slug: "schoenenkast-carini-3-laden-wit",          name: "Schoenenkast 'Carini' 3 laden Wit",               serie: "Carini",  color: "Wit",    materiaal: SCHOEN_MAT, group: "schoenenkast-carini-3-laden" },
  { sku: "5202-3", cat: "schoenenkasten", slug: "schoenenkast-carini-3-laden-sonoma",       name: "Schoenenkast 'Carini' 3 laden Sonoma",            serie: "Carini",  color: "Sonoma", materiaal: SCHOEN_MAT, group: "schoenenkast-carini-3-laden" },
  { sku: "5203-1", cat: "schoenenkasten", slug: "schoenenkast-carini-4-laden-wit",          name: "Schoenenkast 'Carini' 4 laden Wit",               serie: "Carini",  color: "Wit",    materiaal: SCHOEN_MAT, group: "schoenenkast-carini-4-laden" },
  { sku: "5203-3", cat: "schoenenkasten", slug: "schoenenkast-carini-4-laden-sonoma",       name: "Schoenenkast 'Carini' 4 laden Sonoma",            serie: "Carini",  color: "Sonoma", materiaal: SCHOEN_MAT, group: "schoenenkast-carini-4-laden" },
  // ── Kapstokken ──
  { sku: "1090-1", cat: "kapstokken", slug: "kapstok-viola-wit",       name: "Kapstok 'Viola' Wit",       serie: "Viola",  color: "Wit",       materiaal: KAPSTOK_MAT, group: "kapstok-viola" },
  { sku: "1090-2", cat: "kapstokken", slug: "kapstok-viola-mat-zwart", name: "Kapstok 'Viola' Mat zwart", serie: "Viola",  color: "Mat zwart", materiaal: KAPSTOK_MAT, group: "kapstok-viola" },
  { sku: "1100-1", cat: "kapstokken", slug: "kapstok-kassie-wit",      name: "Kapstok 'Kassie' Wit",      serie: "Kassie", color: "Wit",       materiaal: KAPSTOK_MAT, group: "kapstok-kassie" },
  { sku: "1100-2", cat: "kapstokken", slug: "kapstok-kassie-zwart",    name: "Kapstok 'Kassie' Zwart",    serie: "Kassie", color: "Zwart",     materiaal: KAPSTOK_MAT, group: "kapstok-kassie" },
  { sku: "1100-3", cat: "kapstokken", slug: "kapstok-kassie-groen",    name: "Kapstok 'Kassie' Groen",    serie: "Kassie", color: "Groen",     materiaal: KAPSTOK_MAT, group: "kapstok-kassie" },
  { sku: "1100-4", cat: "kapstokken", slug: "kapstok-kassie-rood",     name: "Kapstok 'Kassie' Rood",     serie: "Kassie", color: "Rood",      materiaal: KAPSTOK_MAT, group: "kapstok-kassie" },
];

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}
function toLines(html: string): string[] {
  let t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<[^>]+>/g, "\n");
  t = decodeEntities(t);
  return t.split("\n").map((s) => s.trim()).filter(Boolean);
}
function digits(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}
function afterLabel(lines: string[], label: string): string | undefined {
  const i = lines.findIndex((l) => l === label);
  return i >= 0 ? lines[i + 1] : undefined;
}

type Parsed = {
  width: number | null;
  height: number | null;
  depth: number | null;
  ref: string | null;
  barcode: string | null;
  description: string;
  images: string[];
};

function parse(html: string, sku: string): Parsed {
  const lines = toLines(html);
  const height = digits(afterLabel(lines, "H-H"));
  const width = digits(afterLabel(lines, "B-L"));
  const depth = digits(afterLabel(lines, "D-P"));
  const ref = afterLabel(lines, "REF.") ?? null;
  const barcode = afterLabel(lines, "Barcode") ?? null;
  // Beschrijving: vanaf "Technische informatie", afgekapt vóór
  // "Onderhoudsinformatie" (soms exact op een eigen regel, soms inline).
  let description = "";
  const ti = lines.findIndex((l) => /^Technische informatie$/i.test(l));
  if (ti >= 0) {
    const oi = lines.findIndex((l, idx) => idx > ti && /^Onderhoudsinformatie$/i.test(l));
    const end = oi > ti ? oi : Math.min(ti + 6, lines.length);
    description = lines.slice(ti + 1, end).join(" ").replace(/\s+/g, " ").trim();
    description = description.split(/Onderhoudsinformatie/i)[0].trim();
  }
  const set = new Set<string>();
  const re = /\/upload\/[0-9a-f-]{36}\/[^"'\s>]+?\.(?:jpg|jpeg|png)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[0]);
  const idxNum = (u: string) => {
    const n = decodeURIComponent(u).match(/(\d+)(?=\.(?:jpg|jpeg|png)$)/i);
    return n ? parseInt(n[1], 10) : 999;
  };
  const images = [...set]
    .filter((u) => decodeURIComponent(u).includes(sku))
    .sort((a, b) => idxNum(a) - idxNum(b))
    .map((u) => `${BASE}${u}?w=2000&fit=max`);
  return { width, height, depth, ref, barcode, description, images };
}

async function fetchHtml(item: Item): Promise<string> {
  const res = await fetch(`${BASE}/nl/producten/berging/${item.cat}/${item.sku}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n═══ Rousseau berging — ${ITEMS.length} SKU's (schoenenkasten + kapstokken) ═══`);
  console.log(APPLY ? "MODE: APPLY (live DB + Cloudinary)\n" : "MODE: dry-run\n");

  const parsedAll: { item: Item; p: Parsed }[] = [];
  for (const item of ITEMS) {
    try {
      const html = await fetchHtml(item);
      const p = parse(html, item.sku);
      parsedAll.push({ item, p });
      const dim = p.width && p.depth && p.height ? `B${p.width}×D${p.depth}×H${p.height}` : "DIMS?";
      const ok = p.images.length > 0 && p.width && p.height ? "✓" : "⚠";
      console.log(`${ok} ${item.sku.padEnd(7)} ${item.slug.padEnd(42)} ${item.color.padEnd(10)} ${dim.padEnd(16)} ${String(p.images.length).padStart(2)} foto's`);
      await sleep(250);
    } catch (e) {
      console.error(`✗ ${item.sku}: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (!APPLY) {
    console.log(`\nDry-run klaar. ${parsedAll.length}/${ITEMS.length} geparsed. Run met --apply.`);
    await prisma.$disconnect();
    process.exit(0);
  }

  // FASE 1 — alle foto's naar Cloudinary (geen DB; voorkomt Neon pool-timeout).
  console.log("\n─── Fase 1: Cloudinary-uploads ───");
  const built: { item: Item; uploaded: { url: string; w: number; h: number }[]; p: Parsed }[] = [];
  for (const { item, p } of parsedAll) {
    if (p.images.length === 0) { console.log(`⏭ skip ${item.slug} (geen foto's)`); continue; }
    process.stdout.write(`📦 ${item.slug} `);
    const uploaded: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < p.images.length; i++) {
      const pid = `mokka/${item.cat}/${item.slug}/${String(i + 1).padStart(2, "0")}`;
      try {
        const r = await cloudinary.uploader.upload(p.images[i], {
          public_id: pid, overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
        });
        uploaded.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch (e) {
        process.stdout.write("x");
        console.error(`\n  ✗ foto ${i + 1}: ${e instanceof Error ? e.message : e}`);
      }
    }
    built.push({ item, uploaded, p });
    process.stdout.write(` (${uploaded.length})\n`);
  }

  // FASE 2 — DB-writes in één snelle batch.
  console.log("\n─── Fase 2: DB ───");
  for (const { item, uploaded, p } of built) {
    const specs: Record<string, string> = {
      Categorie: item.cat === "kapstokken" ? "Kapstok" : "Schoenenkast",
      Serie: item.serie,
      Materiaal: item.materiaal,
      Kleur: item.color,
    };
    if (p.width && p.depth && p.height) specs.Afmetingen = `B ${p.width} × D ${p.depth} × H ${p.height} cm`;
    if (p.barcode) specs.EAN = p.barcode;
    if (p.ref) specs.Artikelnummer = p.ref;
    const fallbackDesc = item.cat === "kapstokken"
      ? `Kapstok uit de ${item.serie}-serie, uitgevoerd in ${item.materiaal.toLowerCase()}.`
      : `Schoenenkast uit de ${item.serie}-serie, uitgevoerd in ${item.materiaal.toLowerCase()}.`;
    const data = {
      name: item.name,
      description: p.description || fallbackDesc,
      price: 0, category: item.cat,
      images: JSON.stringify(uploaded), specs: JSON.stringify(specs),
      colorGroup: item.group, colorName: item.color, colorHex: COLOR_HEX[item.color] ?? null,
      source: "Rousseau", hidden: true, stock: 10,
    };
    await prisma.product.upsert({ where: { slug: item.slug }, update: data, create: { slug: item.slug, ...data } });
    console.log(`  ✓ ${item.slug} (${uploaded.length} foto's)`);
  }
  console.log("\n✅ Berging klaar (verborgen, €0, source 'Rousseau' — vul prijzen en zet zichtbaar).");
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
