// Import Rousseau-bedden (dealer). Zelfde aanpak als kledingkasten:
// detailpagina parsen → foto's @2000px naar Cloudinary → VERBORGEN producten
// (prijs €0). Roma heeft kleur/materiaal-varianten per maat → colorGroup.
//
// Dry-run:  npx tsx scripts/import-rousseau-bedden.ts
// Apply:    npx tsx scripts/import-rousseau-bedden.ts --apply

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
const DETAIL = `${BASE}/nl/producten/slaapkamer/bedden`;

const COLOR_HEX: Record<string, string> = {
  Donkergrijs: "#4A4744",
  Grijs: "#8E8B85",
  Wit: "#F5F5F0",
  Zwart: "#1C1C1C",
};
const COLOR_SLUG: Record<string, string> = {
  Donkergrijs: "donkergrijs",
  Grijs: "grijs",
  Wit: "wit",
  Zwart: "zwart",
};

type Item = { sku: string; slug: string; name: string; group: string | null; serie: string; maat: string; color: string; materiaal: string };

// group = serie+maat ALLEEN waar echte varianten bestaan (Roma PU vs Stof); anders null.
// name = expliciet (Rousseau-listingnaam, x→× genormaliseerd) — betrouwbaarder
// dan de detailpagina parsen (NEW/SALE-badges verstoren de naamregel).
const ITEMS: Item[] = [
  { sku: "89509",   slug: "bed-sammy-90x200-donkergrijs",  name: "Bed 'Sammy' 90×200 Metaal Donkergrijs",  group: null, serie: "Sammy",  maat: "90×200",  color: "Donkergrijs", materiaal: "Metaal" },
  { sku: "89514",   slug: "bed-sammy-140x200-donkergrijs", name: "Bed 'Sammy' 140×200 Metaal Donkergrijs", group: null, serie: "Sammy",  maat: "140×200", color: "Donkergrijs", materiaal: "Metaal" },
  { sku: "89516",   slug: "bed-sammy-160x200-donkergrijs", name: "Bed 'Sammy' 160×200 Metaal Donkergrijs", group: null, serie: "Sammy",  maat: "160×200", color: "Donkergrijs", materiaal: "Metaal" },
  { sku: "89614",   slug: "bed-davy-140x200-donkergrijs",  name: "Bed 'Davy' 140×200 Metaal Donkergrijs",  group: null, serie: "Davy",   maat: "140×200", color: "Donkergrijs", materiaal: "Metaal" },
  { sku: "89409",   slug: "bed-sandro-90x200-grijs",       name: "Bed 'Sandro' 90×200 met lattenbodem Grijs",  group: null, serie: "Sandro", maat: "90×200",  color: "Grijs",       materiaal: "Metaal met lattenbodem" },
  { sku: "89414",   slug: "bed-sandro-140x200-grijs",      name: "Bed 'Sandro' 140×200 met lattenbodem Grijs", group: null, serie: "Sandro", maat: "140×200", color: "Grijs",       materiaal: "Metaal met lattenbodem" },
  { sku: "89416",   slug: "bed-sandro-160x200-grijs",      name: "Bed 'Sandro' 160×200 met lattenbodem Grijs", group: null, serie: "Sandro", maat: "160×200", color: "Grijs",       materiaal: "Metaal met lattenbodem" },
  { sku: "88109-1", slug: "bed-sablo-90x200-wit",          name: "Bed 'Sablo' 90×200 met lattenbodem Wit",  group: null, serie: "Sablo",  maat: "90×200",  color: "Wit",         materiaal: "Metaal met lattenbodem" },
  { sku: "88209-1", slug: "bed-sacha-90x200-wit",          name: "Bed 'Sacha' 90×200 met lattenbodem Wit",  group: null, serie: "Sacha",  maat: "90×200",  color: "Wit",         materiaal: "Metaal met lattenbodem" },
  { sku: "89519-3", slug: "bed-parma-90x200-stof-grijs",   name: "Bed 'Parma' 90×200 met lattenbodem Stof Grijs", group: null, serie: "Parma",  maat: "90×200",  color: "Grijs",       materiaal: "Stof" },
  { sku: "89526-2", slug: "bed-porto-koffer-160x200-zwart", name: "Bed met koffer 'Porto' 160×200 PU Zwart", group: null, serie: "Porto", maat: "160×200", color: "Zwart",       materiaal: "Kunstleer (PU)" },
  // Roma — varianten per maat (PU Zwart + Stof Grijs)
  { sku: "89514-2", slug: "bed-roma-140x200-pu-zwart",   name: "Bed 'Roma' 140×200 met lattenbodem PU Zwart",   group: "bed-roma-140", serie: "Roma", maat: "140×200", color: "Zwart", materiaal: "Kunstleer (PU)" },
  { sku: "89514-3", slug: "bed-roma-140x200-stof-grijs", name: "Bed 'Roma' 140×200 met lattenbodem Stof Grijs", group: "bed-roma-140", serie: "Roma", maat: "140×200", color: "Grijs", materiaal: "Stof" },
  { sku: "89516-2", slug: "bed-roma-160x200-pu-zwart",   name: "Bed 'Roma' 160×200 met lattenbodem PU Zwart",   group: "bed-roma-160", serie: "Roma", maat: "160×200", color: "Zwart", materiaal: "Kunstleer (PU)" },
  { sku: "89516-3", slug: "bed-roma-160x200-stof-grijs", name: "Bed 'Roma' 160×200 met lattenbodem Stof Grijs", group: "bed-roma-160", serie: "Roma", maat: "160×200", color: "Grijs", materiaal: "Stof" },
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
function afterLabel(lines: string[], label: string): string | undefined {
  const i = lines.findIndex((l) => l === label);
  return i >= 0 ? lines[i + 1] : undefined;
}

type Parsed = { name: string; barcode: string | null; ref: string | null; description: string; images: string[] };

function parse(html: string, sku: string): Parsed {
  const lines = toLines(html);
  const hh = lines.findIndex((l) => l === "H-H");
  let name = hh > 0 ? lines[hh - 1] : "";
  name = name.replace(/^\s*(NEW|NIEUW|SALE)\s*-\s*/i, "").trim();
  const ref = afterLabel(lines, "REF.") ?? null;
  const barcode = afterLabel(lines, "Barcode") ?? null;
  let description = "";
  const ti = lines.findIndex((l) => /^Technische informatie$/i.test(l));
  const oi = lines.findIndex((l) => /^Onderhoudsinformatie$/i.test(l));
  if (ti >= 0) {
    const end = oi > ti ? oi : Math.min(ti + 5, lines.length);
    description = lines.slice(ti + 1, end).join(" ").replace(/\s+/g, " ").trim();
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
  return { name, barcode, ref, description, images };
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
  console.log(`\n═══ Rousseau bedden — ${ITEMS.length} SKU's ═══`);
  console.log(APPLY ? "MODE: APPLY (live DB + Cloudinary)\n" : "MODE: dry-run\n");

  const parsedAll: { item: Item; p: Parsed }[] = [];
  for (const item of ITEMS) {
    try {
      const html = await fetchHtml(item.sku);
      const p = parse(html, item.sku);
      parsedAll.push({ item, p });
      const ok = p.images.length > 0 ? "✓" : "⚠";
      console.log(`${ok} ${item.sku.padEnd(8)} ${item.slug.padEnd(34)} ${item.color.padEnd(12)} ${String(p.images.length).padStart(2)} foto's  ${p.name}`);
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

  // FASE 1 — alle foto's naar Cloudinary (geen DB; voorkomt pool-timeout
  // doordat een Neon-poolverbinding 30s+ idle staat tijdens uploads).
  console.log("\n─── Fase 1: Cloudinary-uploads ───");
  const built: { item: Item; uploaded: { url: string; w: number; h: number }[]; desc: string; barcode: string | null; ref: string | null }[] = [];
  for (const { item, p } of parsedAll) {
    if (p.images.length === 0) { console.log(`⏭ skip ${item.slug} (geen foto's)`); continue; }
    process.stdout.write(`📦 ${item.slug} `);
    const uploaded: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < p.images.length; i++) {
      const pid = `mokka/bedden/${item.slug}/${String(i + 1).padStart(2, "0")}`;
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
    built.push({ item, uploaded, desc: p.description, barcode: p.barcode, ref: p.ref });
    process.stdout.write(` (${uploaded.length})\n`);
  }

  // FASE 2 — DB-writes in één snelle batch (verbinding blijft warm).
  console.log("\n─── Fase 2: DB ───");
  for (const b of built) {
    const { item } = b;
    const specs: Record<string, string> = {
      Categorie: "Bed", Serie: item.serie, Materiaal: item.materiaal,
      Kleur: item.color, Afmetingen: `${item.maat} cm`,
    };
    if (b.barcode) specs.EAN = b.barcode;
    if (b.ref) specs.Artikelnummer = b.ref;
    const data = {
      name: item.name,
      description: b.desc || `Bed uit de ${item.serie}-serie (${item.maat} cm), uitgevoerd in ${item.materiaal.toLowerCase()}.`,
      price: 0, category: "bedden",
      images: JSON.stringify(b.uploaded), specs: JSON.stringify(specs),
      colorGroup: item.group, colorName: item.color, colorHex: COLOR_HEX[item.color] ?? null,
      hidden: true, stock: 10,
    };
    await prisma.product.upsert({ where: { slug: item.slug }, update: data, create: { slug: item.slug, ...data } });
    console.log(`  ✓ ${item.slug} (${b.uploaded.length} foto's)`);
  }
  console.log("\n✅ Bedden klaar (verborgen, €0 — vul prijzen en zet zichtbaar).");
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
