// Import Rousseau kledingkasten (dealer-assortiment).
// Haalt per artikelnummer de detailpagina, parseert specs + foto's,
// uploadt foto's @2000px naar Cloudinary, maakt VERBORGEN producten (prijs €0).
//
// Dry-run:  npx tsx scripts/import-rousseau-kledingkasten.ts
// Apply:    npx tsx scripts/import-rousseau-kledingkasten.ts --apply
//
// Kleuren = varianten binnen één colorGroup (deur-aantal = aparte groep).

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
const DETAIL = `${BASE}/nl/producten/slaapkamer/kledingkasten`;

const COLOR_HEX: Record<string, string> = {
  Donkergrijs: "#4A4744",
  Wit: "#F5F5F0",
  Sonoma: "#C9A876",
  "Grijze eik": "#A39A8C",
};
const COLOR_SLUG: Record<string, string> = {
  Donkergrijs: "donkergrijs",
  Wit: "wit",
  Sonoma: "sonoma",
  "Grijze eik": "grijze-eik",
};

type Item = { sku: string; group: string; serie: string; color: string };

// Groep = model + deur-aantal; kleuren binnen een groep zijn varianten (swatches).
const ITEMS: Item[] = [
  // ── Marc (draaideuren met spiegel) ──
  { sku: "6905-3", group: "kledingkast-marc-2-deurs-spiegel", serie: "Marc", color: "Donkergrijs" },
  { sku: "6905-1", group: "kledingkast-marc-2-deurs-spiegel", serie: "Marc", color: "Wit" },
  { sku: "6905-2", group: "kledingkast-marc-2-deurs-spiegel", serie: "Marc", color: "Sonoma" },
  { sku: "6915-3", group: "kledingkast-marc-3-deurs-spiegel", serie: "Marc", color: "Donkergrijs" },
  { sku: "6915-1", group: "kledingkast-marc-3-deurs-spiegel", serie: "Marc", color: "Wit" },
  { sku: "6915-2", group: "kledingkast-marc-3-deurs-spiegel", serie: "Marc", color: "Sonoma" },
  { sku: "6925-3", group: "kledingkast-marc-4-deurs-spiegel", serie: "Marc", color: "Donkergrijs" },
  { sku: "6925-1", group: "kledingkast-marc-4-deurs-spiegel", serie: "Marc", color: "Wit" },
  { sku: "6925-2", group: "kledingkast-marc-4-deurs-spiegel", serie: "Marc", color: "Sonoma" },
  // ── Mike (draai- en schuifdeuren) ──
  { sku: "6765-1", group: "kledingkast-mike-schuifdeur-spiegel", serie: "Mike", color: "Wit" },
  { sku: "6765-2", group: "kledingkast-mike-schuifdeur-spiegel", serie: "Mike", color: "Sonoma" },
  { sku: "6760-2", group: "kledingkast-mike-2-schuifdeuren", serie: "Mike", color: "Sonoma" },
  { sku: "6705-1", group: "kledingkast-mike-2-deurs", serie: "Mike", color: "Wit" },
  { sku: "6705-2", group: "kledingkast-mike-2-deurs", serie: "Mike", color: "Sonoma" },
  { sku: "6710-1", group: "kledingkast-mike-3-deurs", serie: "Mike", color: "Wit" },
  { sku: "6710-2", group: "kledingkast-mike-3-deurs", serie: "Mike", color: "Sonoma" },
  { sku: "6720-1", group: "kledingkast-mike-4-deurs", serie: "Mike", color: "Wit" },
  { sku: "6720-2", group: "kledingkast-mike-4-deurs", serie: "Mike", color: "Sonoma" },
  // ── Ray (kledingkast + opbergkasten met legplanken) ──
  { sku: "6310-2", group: "kledingkast-ray-3-deurs", serie: "Ray", color: "Sonoma" },
  { sku: "6310-5", group: "kledingkast-ray-3-deurs", serie: "Ray", color: "Grijze eik" },
  { sku: "6403-1", group: "opbergkast-ray-2-deurs-6403", serie: "Ray", color: "Wit" },
  { sku: "6403-2", group: "opbergkast-ray-2-deurs-6403", serie: "Ray", color: "Sonoma" },
  { sku: "6403-5", group: "opbergkast-ray-2-deurs-6403", serie: "Ray", color: "Grijze eik" },
  { sku: "6405-1", group: "opbergkast-ray-2-deurs-6405", serie: "Ray", color: "Wit" },
  { sku: "6405-2", group: "opbergkast-ray-2-deurs-6405", serie: "Ray", color: "Sonoma" },
  { sku: "6405-5", group: "opbergkast-ray-2-deurs-6405", serie: "Ray", color: "Grijze eik" },
  { sku: "6410-1", group: "opbergkast-ray-3-deurs-6410", serie: "Ray", color: "Wit" },
  { sku: "6410-2", group: "opbergkast-ray-3-deurs-6410", serie: "Ray", color: "Sonoma" },
  { sku: "6410-5", group: "opbergkast-ray-3-deurs-6410", serie: "Ray", color: "Grijze eik" },
];

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
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
  name: string;
  type: string;
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
  const hhIdx = lines.findIndex((l) => l === "H-H");
  let name = hhIdx > 0 ? lines[hhIdx - 1] : "";
  name = name.replace(/^\s*(NEW|NIEUW)\s*-\s*/i, "").trim();
  const type = /^opbergkast/i.test(name) ? "Opbergkast" : "Kledingkast";
  const height = digits(afterLabel(lines, "H-H"));
  const width = digits(afterLabel(lines, "B-L"));
  const depth = digits(afterLabel(lines, "D-P"));
  const ref = afterLabel(lines, "REF.") ?? null;
  const barcode = afterLabel(lines, "Barcode") ?? null;
  // Beschrijving: alles tussen "Technische informatie" en "Onderhoudsinformatie"
  let description = "";
  const ti = lines.findIndex((l) => /^Technische informatie$/i.test(l));
  const oi = lines.findIndex((l) => /^Onderhoudsinformatie$/i.test(l));
  if (ti >= 0) {
    const end = oi > ti ? oi : Math.min(ti + 5, lines.length);
    description = lines.slice(ti + 1, end).join(" ").replace(/\s+/g, " ").trim();
  }
  // Foto's: alle /upload/UUID/...<sku>....jpg, ontdubbeld, gesorteerd op index-nummer
  const set = new Set<string>();
  const re = /\/upload\/[0-9a-f-]{36}\/[^"'\s>]+?\.(?:jpg|jpeg|png)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[0]);
  const idxNum = (u: string) => {
    const dec = decodeURIComponent(u);
    const n = dec.match(/(\d+)(?=\.(?:jpg|jpeg|png)$)/i);
    return n ? parseInt(n[1], 10) : 999;
  };
  const images = [...set]
    .filter((u) => decodeURIComponent(u).includes(sku))
    .sort((a, b) => idxNum(a) - idxNum(b))
    .map((u) => `${BASE}${u}?w=2000&fit=max`);
  return { name, type, width, height, depth, ref, barcode, description, images };
}

async function fetchHtml(sku: string): Promise<string> {
  const res = await fetch(`${DETAIL}/${sku}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n═══ Rousseau kledingkasten — ${ITEMS.length} SKU's ═══`);
  console.log(APPLY ? "MODE: APPLY (live DB + Cloudinary)\n" : "MODE: dry-run (alleen parsen)\n");

  const parsedAll: { item: Item; p: Parsed; slug: string }[] = [];
  for (const item of ITEMS) {
    try {
      const html = await fetchHtml(item.sku);
      const p = parse(html, item.sku);
      const slug = `${item.group}-${COLOR_SLUG[item.color]}`;
      parsedAll.push({ item, p, slug });
      const dim = p.width && p.depth && p.height ? `B${p.width}×D${p.depth}×H${p.height}` : "DIMS?";
      const ok = p.images.length > 0 && p.width && p.height ? "✓" : "⚠";
      console.log(`${ok} ${item.sku.padEnd(7)} ${slug.padEnd(42)} ${item.color.padEnd(12)} ${dim.padEnd(16)} ${String(p.images.length).padStart(2)} foto's`);
      if (p.images.length === 0) console.log(`     ⚠ GEEN foto's gevonden voor ${item.sku}`);
      await sleep(250);
    } catch (e) {
      console.error(`✗ ${item.sku}: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (!APPLY) {
    console.log(`\nDry-run klaar. ${parsedAll.length}/${ITEMS.length} geparsed. Run met --apply om te importeren.`);
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log("\n─── Uploaden + DB ───");
  for (const { item, p, slug } of parsedAll) {
    if (p.images.length === 0) {
      console.log(`⏭ skip ${slug} (geen foto's)`);
      continue;
    }
    process.stdout.write(`\n📦 ${slug} `);
    const uploaded: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < p.images.length; i++) {
      const pid = `mokka/kledingkasten/${slug}/${String(i + 1).padStart(2, "0")}`;
      try {
        const r = await cloudinary.uploader.upload(p.images[i], {
          public_id: pid, overwrite: true, resource_type: "image",
          quality: "auto:best", fetch_format: "auto",
        });
        uploaded.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch (e) {
        process.stdout.write("x");
        console.error(`\n  ✗ foto ${i + 1}: ${e instanceof Error ? e.message : e}`);
      }
    }
    const specs: Record<string, string> = {
      Categorie: p.type,
      Serie: item.serie,
      Materiaal: "Spaanderplaat & MDF",
      Kleur: item.color,
    };
    if (p.width && p.depth && p.height) specs.Afmetingen = `B ${p.width} × D ${p.depth} × H ${p.height} cm`;
    if (p.barcode) specs.EAN = p.barcode;
    if (p.ref) specs.Artikelnummer = p.ref;

    const data = {
      name: p.name,
      description: p.description || `${p.type} uit de ${item.serie}-serie, uitgevoerd in spaanderplaat met MDF-fronten.`,
      price: 0,
      category: "kledingkasten",
      images: JSON.stringify(uploaded),
      specs: JSON.stringify(specs),
      colorGroup: item.group,
      colorName: item.color,
      colorHex: COLOR_HEX[item.color] ?? null,
      hidden: true,
      stock: 10,
    };
    const ex = await prisma.product.findUnique({ where: { slug } });
    if (ex) {
      await prisma.product.update({ where: { id: ex.id }, data });
      process.stdout.write(` ✓ updated (${uploaded.length})`);
    } else {
      await prisma.product.create({ data: { slug, ...data } });
      process.stdout.write(` ✓ created (${uploaded.length})`);
    }
  }
  console.log("\n\n✅ Rousseau kledingkasten klaar (verborgen, €0 — vul prijzen en zet zichtbaar).");
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
