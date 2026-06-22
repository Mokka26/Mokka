// Import Great Home "Aqua Serie" (edition 73 → 4 kleur-edities). Dezelfde
// keramische tafels/dressoirs in 4 uitvoeringen → gegroepeerd als kleurvarianten.
// Prijs = adviesprijs × 2.5. Op voorraad zichtbaar, uitverkocht verborgen.
//
// Dry-run: npx tsx scripts/import-greathome-aqua.ts
// Apply:   npx tsx scripts/import-greathome-aqua.ts --apply
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
  OptP4S: "V2", OptCustomerCode: '"1241"',
  Authorization: "Basic " + Buffer.from("1241:t164v5K").toString("base64"),
  "Content-Type": "application/json; charset=utf-8",
};
// leaf-editie → kleur-uitvoering
const COLORWAYS: Record<string, { name: string; hex: string; slug: string }> = {
  "415": { name: "Wit/Goud", hex: "#C8A96A", slug: "wit-goud" },
  "479": { name: "Bruin/Beige", hex: "#A98B63", slug: "bruin-beige" },
  "490": { name: "Wit/Zwart", hex: "#D9D7D2", slug: "wit-zwart" },
  "491": { name: "Zwart/Goud", hex: "#2A2A2A", slug: "zwart-goud" },
};

type Item = { ItemCode: string; Description: string; SalesPriceWithoutDiscount: number; StockColor: string; PictureHash: string | null; LinkedPictureHashes: string[]; EANCode?: string };

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function typeInfo(desc: string): { cat: string; nl: string; catSpec: string; token: string } {
  const d = desc.toUpperCase();
  if (/CINEWALL/.test(d)) return { cat: "tv-meubels", nl: "tv-wand", catSpec: "TV-wand", token: "cinewall" };
  if (/CEILING LAMP/.test(d)) return { cat: "plafondlampen", nl: "plafondlamp", catSpec: "Plafondlamp", token: "lamp" };
  if (/\bMIRROR\b/.test(d)) return { cat: "spiegels", nl: "spiegel", catSpec: "Spiegel", token: "mirror" };
  if (/\bCABINET\b/.test(d)) return { cat: "dressoirs", nl: "kast", catSpec: "Kast", token: "cabinet" };
  if (/\bBF\b/.test(d)) return { cat: "dressoirs", nl: "dressoir", catSpec: "Dressoir", token: "bf" };
  if (/\bTT\b/.test(d)) return { cat: "tv-meubels", nl: "tv-meubel", catSpec: "TV-meubel", token: "tt" };
  if (/\bDT\b/.test(d)) return { cat: "eettafels", nl: "eettafel", catSpec: "Eettafel", token: "dt" };
  if (/\bET\b/.test(d)) return { cat: "bijzettafels", nl: "bijzettafel", catSpec: "Bijzettafel", token: "et" };
  if (/\bCT3\b/.test(d)) return { cat: "salontafels", nl: "salontafelset", catSpec: "Salontafel (set)", token: "ct3" };
  if (/\bCT2\b/.test(d)) return { cat: "salontafels", nl: "salontafelset", catSpec: "Salontafel (set)", token: "ct2" };
  if (/\bCT\b/.test(d)) return { cat: "salontafels", nl: "salontafel", catSpec: "Salontafel", token: "ct" };
  return { cat: "salontafels", nl: "tafel", catSpec: "Tafel", token: "x" };
}

// alle 2-3-cijferige getallen → model-sleutel (zelfde maat over kleuren heen)
function dimKey(desc: string): string {
  return (desc.match(/\d{2,3}/g) || []).join("-");
}
function shortDim(desc: string): string {
  const d = desc.replace(/,/g, ".");
  let m = d.match(/(\d{2,3})\s*[Øø]/); if (m) return `Ø${m[1]}`;
  m = d.match(/(\d{2,3})\s*[X*xØ]\s*(\d{2,3})/i); if (m) return `${m[1]}×${m[2]}`;
  m = d.match(/(\d{2,3})/); return m ? `${m[1]} cm` : "";
}
function afmeting(desc: string): string | null {
  const d = desc.replace(/,/g, ".");
  let m = d.match(/(\d{2,3})\s*[Øø]\s*[xX*]?\s*(\d{2,3})/); if (m) return `Ø ${m[1]} × H ${m[2]} cm`;
  m = d.match(/[Øø]\s*(\d{2,3})|(\d{2,3})\s*[Øø]/); if (m) return `Ø ${m[1] || m[2]} cm`;
  m = d.match(/(\d{2,3})\s*[X*x]\s*(\d{2,3})\s*[X*x]\s*(\d{2,3})/); if (m) return `${m[1]} × ${m[2]} × ${m[3]} cm`;
  m = d.match(/(\d{2,3})\s*[X*x]\s*(\d{2,3})/); if (m) return `${m[1]} × ${m[2]} cm`;
  return null;
}
function shape(desc: string): string {
  return /OVAL/i.test(desc) ? "ovaal" : /CLOVER/i.test(desc) ? "klaver" : /FUNGO/i.test(desc) ? "fungo" : /[Øø]|ROUND/i.test(desc) ? "rond" : "";
}

async function fetchEdition(id: string): Promise<Item[]> {
  const res = await fetch(WS + "api/portal4sales/v2/catalog", {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ Edition: id, Filters: [], SearchText: "", Language: "nl", HasNoFiltersOrLinkedProducts: false, Page: 0, PageSize: 300 }),
  });
  return (await res.json()).Items ?? [];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n═══ Great Home — Aqua Serie (edition 73) — ×${MARKUP} ═══`);
  console.log(APPLY ? "MODE: APPLY\n" : "MODE: dry-run\n");

  type Built = {
    slug: string; name: string; category: string; price: number; hidden: boolean;
    catSpec: string; afm: string | null; code: string; ean?: string; imageHashes: string[];
    colorName: string; colorHex: string; colorGroup: string;
  };
  const built: Built[] = [];
  const seen = new Set<string>();

  for (const [edId, cw] of Object.entries(COLORWAYS)) {
    const items = await fetchEdition(edId);
    for (const it of items) {
      const ti = typeInfo(it.Description);
      const isFurniture = !["lamp", "mirror"].includes(ti.token);
      const sh = shape(it.Description);
      // naam: meubels = "Aqua {type} {vorm} {maat} {kleur}"; los = beschrijvend
      const name = isFurniture
        ? ["Aqua", ti.nl, sh, shortDim(it.Description), cw.name.toLowerCase(), "keramiek"].filter(Boolean).join(" ")
        : ti.token === "lamp"
          ? `Plafondlamp travertijn ${shortDim(it.Description)}`.trim()
          : `Spiegel keramiek ${shortDim(it.Description)} ${cw.name.toLowerCase()}`.trim();
      // colorGroup alleen voor meubels die in meerdere kleuren bestaan
      const colorGroup = isFurniture ? `aqua-${ti.token}-${dimKey(it.Description)}` : "";
      let slug = "gh-" + slugify(`aqua ${ti.token} ${shortDim(it.Description)} ${sh} ${cw.slug}`);
      if (seen.has(slug)) slug += "-" + it.ItemCode.slice(-4);
      seen.add(slug);
      const inStock = (it.StockColor || "").toLowerCase() === "green";
      const hashes = [it.PictureHash, ...(it.LinkedPictureHashes || [])].filter(Boolean) as string[];
      built.push({
        slug, name, category: ti.cat, price: Math.round(it.SalesPriceWithoutDiscount * MARKUP),
        hidden: !inStock, catSpec: ti.catSpec, afm: afmeting(it.Description), code: it.ItemCode,
        ean: it.EANCode, imageHashes: hashes, colorName: cw.name, colorHex: cw.hex, colorGroup,
      });
    }
  }

  console.log(`Te importeren: ${built.length} producten\n`);
  const byGroup = new Map<string, number>();
  for (const b of built) if (b.colorGroup) byGroup.set(b.colorGroup, (byGroup.get(b.colorGroup) || 0) + 1);
  for (const b of built) {
    console.log(`${b.hidden ? "verborgen" : "ZICHTBAAR"} · €${b.price} · ${b.category.padEnd(13)} · ${b.colorName.padEnd(12)} · ${b.imageHashes.length}f · ${b.name}`);
  }
  console.log(`\nKleurgroepen (variant-swatches): ${[...byGroup.values()].filter((n) => n > 1).length} groepen met meerdere kleuren`);

  if (!APPLY) { console.log("\n(DRY-RUN — run met --apply)"); await prisma.$disconnect(); process.exit(0); }

  console.log("\n─── Fase 1: Cloudinary ───");
  const withImgs: (Built & { uploaded: { url: string; w: number; h: number }[] })[] = [];
  for (const b of built) {
    process.stdout.write(`📦 ${b.slug} `);
    const uploaded: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < b.imageHashes.length; i++) {
      try {
        const r = await cloudinary.uploader.upload(WS + "api/v2/images/item/" + encodeURIComponent(b.imageHashes[i]), {
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

  console.log("\n─── Fase 2: DB ───");
  for (const b of withImgs) {
    if (!b.uploaded.length) { console.log(`⏭ skip ${b.slug}`); continue; }
    const specs: Record<string, string> = { Categorie: b.catSpec, Serie: "Aqua", Materiaal: "Keramiek / sintersteen", Kleur: b.colorName, Artikelnummer: b.code };
    if (b.afm) specs.Afmetingen = b.afm;
    if (b.ean) specs.EAN = b.ean;
    const data = {
      name: b.name,
      description: `Aqua-collectie — keramisch/sintersteen. Uitvoering ${b.colorName}.${b.afm ? ` Afmeting ${b.afm}.` : ""} Levertijd: 2-4 weken.`,
      price: b.price, category: b.category, images: JSON.stringify(b.uploaded), specs: JSON.stringify(specs),
      colorGroup: b.colorGroup || null, colorName: b.colorName, colorHex: b.colorHex,
      source: "Great Home", hidden: b.hidden, stock: b.hidden ? 0 : 10,
    };
    await prisma.product.upsert({ where: { slug: b.slug }, update: data, create: { slug: b.slug, ...data } });
    console.log(`  ✓ ${b.slug}`);
  }
  console.log(`\n✅ Aqua Serie klaar — ${withImgs.length} producten.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
