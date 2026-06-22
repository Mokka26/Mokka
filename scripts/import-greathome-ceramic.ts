// Import Great Home keramische tafels (edition 58 → ENZO/PANDORA/VALENTINA).
// Bron: app4sales-portaal (catalog API). Foto's publiek → Cloudinary.
// Prijs = adviesprijs (SalesPriceWithoutDiscount) × 2.5. Op voorraad (green)
// = zichtbaar, uitverkocht (red) = verborgen. source "Great Home".
//
// Dry-run: npx tsx scripts/import-greathome-ceramic.ts
// Apply:   npx tsx scripts/import-greathome-ceramic.ts --apply
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
const MARKUP = 2.5;

const WS = "https://api.app4sales.net/greathome/";
const HEADERS = {
  OptP4S: "V2",
  OptCustomerCode: '"1241"',
  Authorization: "Basic " + Buffer.from("1241:t164v5K").toString("base64"),
  "Content-Type": "application/json; charset=utf-8",
};
const EDITIONS: Record<string, string> = { "543": "Enzo", "549": "Pandora", "550": "Valentina" };

type Item = {
  ItemCode: string; Description: string; SalesPriceWithoutDiscount: number;
  StockColor: string; PictureHash: string | null; LinkedPictureHashes: string[]; EANCode?: string;
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function typeInfo(desc: string): { cat: string; nl: string; catSpec: string } {
  const m = desc.match(/\b(CT3|CT2|CT|DT|TT|BF)\b/);
  const t = m ? m[1] : "CT";
  if (t === "DT") return { cat: "eettafels", nl: "eettafel", catSpec: "Eettafel" };
  if (t === "TT") return { cat: "tv-meubels", nl: "tv-meubel", catSpec: "TV-meubel" };
  if (t === "BF") return { cat: "dressoirs", nl: "dressoir", catSpec: "Dressoir" };
  if (t === "CT2" || t === "CT3") return { cat: "salontafels", nl: "salontafelset", catSpec: "Salontafel (set)" };
  return { cat: "salontafels", nl: "salontafel", catSpec: "Salontafel" };
}

function afmeting(desc: string): string | null {
  const d = desc.replace(/,/g, ".");
  let m = d.match(/(\d{2,3})\s*[Ø]\s*\*?\s*(\d{2,3})/);
  if (m) return `Ø ${m[1]} × H ${m[2]} cm`;
  m = d.match(/[Ø]\s*(\d{2,3})/);
  if (m) return `Ø ${m[1]} cm`;
  m = d.match(/(\d{2,3})\s*[X*]\s*(\d{2,3})\s*[X*]\s*(\d{2,3})/i);
  if (m) return `${m[1]} × ${m[2]} × ${m[3]} cm`;
  m = d.match(/(\d{2,3})\s*[X*]\s*(\d{2,3})/i);
  if (m) return `${m[1]} × ${m[2]} cm`;
  return null;
}

function shortDim(desc: string): string {
  const d = desc.replace(/,/g, ".");
  let m = d.match(/(\d{2,3})\s*[Ø]/);
  if (m) return `Ø${m[1]}`;
  m = d.match(/(\d{2,3})\s*[X*]\s*(\d{2,3})/i);
  if (m) return `${m[1]}×${m[2]}`;
  m = d.match(/(\d{2,3})/);
  return m ? `${m[1]} cm` : "";
}

function buildName(serie: string, desc: string, nl: string): string {
  const shape = /OVAL/i.test(desc) ? "ovaal" : /CURVE/i.test(desc) ? "curve" : /[Ø]|ROUND/i.test(desc) ? "rond" : "";
  const finish = /WALNUT/i.test(desc) ? "walnoot" : /CRIMSON/i.test(desc) ? "crimson" : "";
  const parts = [serie, nl, shape, shortDim(desc), finish, "keramiek"].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function fetchEdition(id: string): Promise<Item[]> {
  const res = await fetch(WS + "api/portal4sales/v2/catalog", {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ Edition: id, Filters: [], SearchText: "", Language: "nl", HasNoFiltersOrLinkedProducts: false, Page: 0, PageSize: 300 }),
  });
  const j = await res.json();
  return j.Items ?? [];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n═══ Great Home keramische tafels — markup ×${MARKUP} ═══`);
  console.log(APPLY ? "MODE: APPLY (live DB + Cloudinary)\n" : "MODE: dry-run\n");

  type Built = {
    slug: string; name: string; category: string; price: number; list: number;
    hidden: boolean; serie: string; catSpec: string; afm: string | null;
    code: string; ean?: string; imageHashes: string[];
  };
  const built: Built[] = [];
  const seen = new Set<string>();

  for (const [id, serie] of Object.entries(EDITIONS)) {
    const items = await fetchEdition(id);
    for (const it of items) {
      const { cat, nl, catSpec } = typeInfo(it.Description);
      const name = buildName(serie, it.Description, nl);
      let slug = "gh-" + slugify(`${serie} ${nl} ${shortDim(it.Description)} ${/WALNUT/i.test(it.Description) ? "walnoot" : /CRIMSON/i.test(it.Description) ? "crimson" : ""}`);
      if (seen.has(slug)) slug += "-" + it.ItemCode.slice(-4);
      seen.add(slug);
      const inStock = (it.StockColor || "").toLowerCase() === "green";
      const hashes = [it.PictureHash, ...(it.LinkedPictureHashes || [])].filter(Boolean) as string[];
      built.push({
        slug, name, category: cat, price: Math.round(it.SalesPriceWithoutDiscount * MARKUP),
        list: it.SalesPriceWithoutDiscount, hidden: !inStock, serie, catSpec,
        afm: afmeting(it.Description), code: it.ItemCode, ean: it.EANCode, imageHashes: hashes,
      });
    }
  }

  console.log(`Te importeren: ${built.length} producten\n`);
  for (const b of built) {
    console.log(`${b.hidden ? "verborgen" : "ZICHTBAAR"} · €${b.price} · ${b.category.padEnd(12)} · ${b.imageHashes.length} foto's`);
    console.log(`   ${b.name}  [${b.code}]`);
  }

  if (!APPLY) {
    console.log("\n(DRY-RUN — run met --apply om te importeren)");
    await prisma.$disconnect(); process.exit(0);
  }

  // FASE 1 — foto's naar Cloudinary
  console.log("\n─── Fase 1: Cloudinary ───");
  const withImgs: (Built & { uploaded: { url: string; w: number; h: number }[] })[] = [];
  for (const b of built) {
    process.stdout.write(`📦 ${b.slug} `);
    const uploaded: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < b.imageHashes.length; i++) {
      const src = WS + "api/v2/images/item/" + encodeURIComponent(b.imageHashes[i]);
      try {
        const r = await cloudinary.uploader.upload(src, {
          public_id: `mokka/${b.category}/${b.slug}/${String(i + 1).padStart(2, "0")}`,
          overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto",
        });
        uploaded.push({ url: r.secure_url, w: r.width, h: r.height });
        process.stdout.write(".");
      } catch { process.stdout.write("x"); }
    }
    withImgs.push({ ...b, uploaded });
    process.stdout.write(` (${uploaded.length})\n`);
    await sleep(120);
  }

  // FASE 2 — DB
  console.log("\n─── Fase 2: DB ───");
  for (const b of withImgs) {
    if (!b.uploaded.length) { console.log(`⏭ skip ${b.slug} (geen foto's)`); continue; }
    const specs: Record<string, string> = {
      Categorie: b.catSpec, Serie: b.serie, Materiaal: "Keramiek / sintersteen", Artikelnummer: b.code,
    };
    if (b.afm) specs.Afmetingen = b.afm;
    if (b.ean) specs.EAN = b.ean;
    const data = {
      name: b.name,
      description: `${b.serie}-collectie — keramisch/sintersteen tafelblad. ${b.afm ? `Afmeting ${b.afm}. ` : ""}Levertijd: 2-4 weken.`,
      price: b.price, category: b.category,
      images: JSON.stringify(b.uploaded), specs: JSON.stringify(specs),
      source: "Great Home", hidden: b.hidden, stock: b.hidden ? 0 : 10,
    };
    await prisma.product.upsert({ where: { slug: b.slug }, update: data, create: { slug: b.slug, ...data } });
    console.log(`  ✓ ${b.slug} (${b.uploaded.length} foto's)`);
  }
  console.log(`\n✅ Great Home keramiek klaar — ${withImgs.length} producten, source 'Great Home'.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
