// Import LivingFurn tafels (dealer, Magento/Hyvä-shop). Listing per categorie
// (alle pagina's) → detailpagina → specs-tabel + gallery → Cloudinary.
//
// Prijs = de prijs die de listing toont (element "tempInkoopPrice" — mogelijk
// de inkoopprijs). Daarom VERBORGEN importeren; de user bevestigt het
// prijsniveau voor publicatie. Voorraad is zonder dealer-login niet zichtbaar.
// Bestaande SKU's (specs.Artikelnummer, source LivingFurn) worden overgeslagen.
//
// Dry-run: npx tsx scripts/import-livingfurn-tafels.ts --only=eettafels
// Apply:   npx tsx scripts/import-livingfurn-tafels.ts --only=eettafels --apply
// Flags:   --force (bestaande SKU's overschrijven — reset prijs/zichtbaarheid!)
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
const FORCE = process.argv.includes("--force");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
// LivingFurn nummert nieuwe artikelen oplopend; --min-sku=31609 = alleen artikelen
// nieuwer dan de stoelen-import (hoogste SKU daar: 31608).
const MIN_SKU = Number(process.argv.find((a) => a.startsWith("--min-sku="))?.split("=")[1] ?? "0");
const BASE = "https://www.livingfurn.nl/nl";
const SOURCE = "LivingFurn";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
// Zelfde levertijd als scripts/set-delivery-times.ts voor LivingFurn.
const DELIVERY = "Binnen 5 werkdagen";

const SOURCES: { path: string; cat: string }[] = [
  { path: "tafels/eetkamertafels", cat: "eettafels" },
  { path: "tafels/salontafels", cat: "salontafels" },
  { path: "tafels/bijzettafels", cat: "bijzettafels" },
];

// Kleurcode (LivingFurn) → swatch. Onbekend = geen swatch (null).
const COLOR_HEX: Record<string, string> = {
  natural: "#C8A877", naturel: "#C8A877", espresso: "#4A3527", walnoot: "#5A3E2B", walnut: "#5A3E2B",
  black: "#1C1C1C", zwart: "#1C1C1C", white: "#F5F5F0", wit: "#F5F5F0", bottecino: "#D9CFC0",
  malta: "#C9B79C", basalt: "#4A4744", camel: "#B68A5B", brown: "#6F4E37", bruin: "#6F4E37",
  grey: "#8E8B85", grijs: "#8E8B85", beige: "#D8C7A8", sand: "#D8C9B0", travertin: "#C9B79C",
  marble: "#E6E3DE", marmer: "#E6E3DE", oak: "#B89B6E", eiken: "#B89B6E", teak: "#A0714A",
};

function decode(s: string): string {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;|&#x27;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/\s+/g, " ").trim();
}
const stripTags = (s: string) => decode(s.replace(/<[^>]*>/g, " "));
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

type Card = { src: string; name: string; sku: string | null; price: number | null; collection: string | null };

function parseCards(html: string): Card[] {
  const cards: Card[] = [];
  const re = /<a href="https:\/\/www\.livingfurn\.nl\/nl\/([a-z0-9-]+)" class="group text-sm flex flex-col gap-4">([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, src, body] = m;
    const name = decode(body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "");
    const sku = body.match(/SKU:\s*([0-9A-Za-z-]+)/)?.[1] ?? null;
    const priceRaw = body.match(/€\s*([0-9.]+(?:,[0-9]{2})?)/)?.[1];
    const price = priceRaw ? parseFloat(priceRaw.replace(/\./g, "").replace(",", ".")) : null;
    const collection = decode(body.match(/<h3[^>]*>[\s\S]*?<\/h3>\s*<div class="text-secondary-darker">([\s\S]*?)<\/div>/)?.[1] ?? "") || null;
    if (name) cards.push({ src, name, sku, price, collection });
  }
  return cards;
}

async function listCategory(path: string): Promise<Card[]> {
  const seen = new Map<string, Card>();
  for (let p = 1; p <= 20; p++) {
    const html = await fetchHtml(`${BASE}/categorieen/${path}?p=${p}`);
    const cards = parseCards(html);
    const fresh = cards.filter((c) => !seen.has(c.src));
    if (!fresh.length) break; // laatste pagina herhaalt → klaar
    for (const c of fresh) seen.set(c.src, c);
    await sleep(300);
  }
  return [...seen.values()];
}

type Detail = { name: string; attrs: Record<string, string>; images: string[]; description: string };

function parseDetail(html: string, skuHint: string | null): Detail {
  const name = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  // Specs-tabel: <th ... product-attribute-label ...>Label</th> <td ... product-attribute-value ...>Waarde</td>
  const attrs: Record<string, string> = {};
  const reRow = /product-attribute-label"[^>]*>\s*([^<]+?)\s*<\/th>\s*<td[^>]*product-attribute-value"[^>]*>\s*([\s\S]*?)\s*<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = reRow.exec(html))) attrs[decode(m[1])] = stripTags(m[2]);
  const sku = attrs.SKU ?? skuHint ?? "";
  // Gallery: "full":"https:\/\/...\/31730_2.jpg?..." — alleen eigen SKU, geen montage-instructies.
  const set = new Set<string>();
  const reImg = /"full":"(https:[^"]+?)"/g;
  while ((m = reImg.exec(html))) {
    const u = m[1].replace(/\\\//g, "/").split("?")[0];
    if (/instruction|assembly|montage|maatschets|dimension/i.test(u)) continue;
    const file = u.split("/").pop() ?? "";
    // Bestandsnaam begint met het eigen SKU-nummer (31725_1kopie.jpg, 31585_4_-_kopie_1.jpg …).
    if (sku && !new RegExp(`^${sku}(?!\\d)`).test(file)) continue;
    set.add(u);
  }
  // Geen enkele foto op eigen SKU-naam? Dan alle gallery-foto's die niet
  // duidelijk van een ander artikel zijn (bestandsnaam begint met een ander SKU-nummer).
  if (!set.size) {
    const reImg2 = /"full":"(https:[^"]+?)"/g;
    while ((m = reImg2.exec(html))) {
      const u = m[1].replace(/\\\//g, "/").split("?")[0];
      if (/instruction|assembly|montage|maatschets|dimension/i.test(u)) continue;
      const file = u.split("/").pop() ?? "";
      const other = file.match(/^(\d{4,6})(?:_|\.)/)?.[1];
      if (other && sku && other !== sku) continue;
      set.add(u);
    }
  }
  const idx = (u: string) => parseInt(u.match(/_(\d+)\.\w+$/)?.[1] ?? "0", 10);
  const images = [...set].sort((a, b) => idx(a) - idx(b)).map((u) => `${u}?store=nl&image-type=image`);
  // Omschrijving: meta-description is een (afgekapte) kopie van de productparagraaf.
  // Zoek met het begin daarvan de volledige paragraaf in de body-tekst.
  const meta = decode(html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? "");
  let description = meta;
  if (meta.length >= 40) {
    const needle = meta.slice(0, 40);
    const text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, "\n");
    const line = text.split("\n").map((l) => decode(l)).find((l) => l.startsWith(needle));
    if (line && line.length > meta.length) description = line;
  }
  return { name, attrs, images, description };
}

function dims(a: Record<string, string>, name = ""): string | null {
  // 0 of negatief = niet ingevuld bij de bron (bv. Brix Xavier set: "Breedte 0").
  const n = (k: string) => { const v = a[k]; const d = v ? parseFloat(v) : NaN; return Number.isFinite(d) && d > 0 ? Math.round(d) : null; };
  // LivingFurn zet bij langwerpige tafels soms de korte zijde als "Breedte"
  // (B 110 × D 300). Wij tonen altijd lengte als B en de korte zijde als D.
  let b = n("Artikel A - Breedte"), d = n("Artikel A - Diepte"), h = n("Artikel A - Hoogte");
  // Typo bij de bron: "Breedte 24" terwijl de naam "240 cm" zegt (Kala Oval Spider).
  const inName = Number(/(\d{2,3})\s*cm/i.exec(name)?.[1] ?? NaN);
  if (b && Number.isFinite(inName) && b * 10 === inName) b = inName;
  // Invoerfout bij de bron (tafel "130 hoog, 76 diep"): hoogte en diepte verwisseld.
  if (d && h && h > 90 && d <= 80) [d, h] = [h, d];
  if (b && d && d > b) [b, d] = [d, b];
  if (b && d && h) return `B ${b} × D ${d} × H ${h} cm`;
  if (b && h) return `B ${b} × H ${h} cm`;
  return h ? `H ${h} cm` : null;
}
const serieOf = (name: string) => name.replace(/^(brix|lifestyle)\s+/i, "").split(/\s+/)[0] ?? "";

type Built = { card: Card; d: Detail; slug: string; cat: string; serie: string; width: number | null; kleur: string | null };

async function existing(): Promise<{ skus: Set<string>; slugs: Set<string> }> {
  const rows = await prisma.product.findMany({ where: { source: SOURCE, deletedAt: null }, select: { slug: true, specs: true } });
  const skus = new Set<string>(); const slugs = new Set<string>();
  for (const r of rows) { slugs.add(r.slug); try { const s = JSON.parse(r.specs || "{}").Artikelnummer; if (s) skus.add(String(s)); } catch { /* */ } }
  return { skus, slugs };
}

async function main() {
  const sources = ONLY ? SOURCES.filter((s) => s.cat === ONLY || s.path.endsWith(ONLY)) : SOURCES;
  console.log(`\n═══ LivingFurn tafels — ${sources.length} categorie(ën) ═══`);
  console.log(APPLY ? "MODE: APPLY (live)" : "MODE: dry-run");
  console.log(FORCE ? "FORCE: bestaande SKU's worden overschreven\n" : "Bestaande SKU's worden overgeslagen\n");

  const ex = await existing();
  const seenSlugs = new Set(ex.slugs);
  const built: Built[] = [];
  let total = 0, skipped = 0;
  for (const src of sources) {
    const cards = await listCategory(src.path);
    console.log(`── ${src.path} → ${src.cat}  (${cards.length} producten) ──`);
    for (const card of cards) {
      total++;
      if (!FORCE && card.sku && ex.skus.has(card.sku)) { skipped++; continue; }
      if (MIN_SKU && card.sku && /^\d+$/.test(card.sku) && Number(card.sku) < MIN_SKU) continue;
      let d: Detail;
      try { d = parseDetail(await fetchHtml(`${BASE}/${card.src}`), card.sku); }
      catch (e) { console.error(`  ✗ ${card.src}: ${e instanceof Error ? e.message : e}`); await sleep(300); continue; }
      const name = d.name || card.name;
      let slug = `lf-${card.src}`;
      if (seenSlugs.has(slug)) slug = `${slug}-${slugify(d.attrs.SKU ?? card.sku ?? "")}`;
      seenSlugs.add(slug);
      const width = d.attrs["Artikel A - Breedte"] ? Math.round(parseFloat(d.attrs["Artikel A - Breedte"])) : null;
      const kleurRaw = d.attrs.Kleurcode?.trim() ?? "";
      const kleur = kleurRaw && !/^(geen|n\/?a|-)$/i.test(kleurRaw) ? kleurRaw : null;
      built.push({ card, d, slug, cat: src.cat, serie: serieOf(name), width, kleur });
      const price = card.price != null ? `€${card.price}` : "€?";
      console.log(`  ${d.images.length ? " " : "⚠"} ${(d.attrs.SKU ?? card.sku ?? "?").padEnd(7)} ${price.padEnd(7)} ${String(d.images.length).padStart(2)}f ${(dims(d.attrs, name) ?? "—").padEnd(24)} ${(kleur ?? "—").padEnd(10)} ${(card.collection ?? "—").slice(0, 10).padEnd(10)} ${name.slice(0, 40).padEnd(40)} descr:${d.description.length}`);
      await sleep(300);
    }
  }

  // Kleurgroepen: zelfde serie + breedte, ≥2 verschillende kleurcodes.
  const groups = new Map<string, Built[]>();
  for (const b of built) { const k = `lf-${slugify(b.serie)}-${b.width ?? "x"}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(b); }
  const groupOf = new Map<Built, string>();
  for (const [k, members] of groups) {
    const colors = new Set(members.map((m) => (m.kleur ?? "").toLowerCase()).filter(Boolean));
    if (members.length >= 2 && colors.size >= 2) for (const m of members) groupOf.set(m, k);
  }
  console.log(`\nGezien: ${total} · al in DB: ${skipped} · te importeren: ${built.length} · kleurgroepen: ${new Set(groupOf.values()).size}`);
  const noPrice = built.filter((b) => b.card.price == null); if (noPrice.length) console.log(`⚠ zonder prijs: ${noPrice.map((b) => b.slug).join(", ")}`);
  const noImg = built.filter((b) => !b.d.images.length); if (noImg.length) console.log(`⚠ zonder foto's: ${noImg.map((b) => b.slug).join(", ")}`);
  if (!APPLY) { console.log("\nDry-run klaar."); await prisma.$disconnect(); process.exit(0); }

  let created = 0;
  for (const b of built) {
    if (!b.d.images.length) { console.log(`⏭ ${b.slug} (geen foto's)`); continue; }
    const uploaded: { url: string; w: number; h: number }[] = [];
    for (let i = 0; i < b.d.images.length; i++) {
      try {
        const r = await cloudinary.uploader.upload(b.d.images[i], { public_id: `mokka/${b.cat}/${b.slug}/${String(i + 1).padStart(2, "0")}`, overwrite: true, resource_type: "image", quality: "auto:best", fetch_format: "auto" });
        uploaded.push({ url: r.secure_url, w: r.width, h: r.height });
      } catch { /* skip foto */ }
    }
    if (!uploaded.length) { console.log(`⏭ ${b.slug} (upload mislukt)`); continue; }
    const a = b.d.attrs;
    const specs: Record<string, string> = {};
    if (b.serie) specs.Serie = b.serie;
    const af = dims(a, b.d.name || b.card.name); if (af) specs.Afmetingen = af;
    if (a["Materiaalsoort(en)"]) specs.Materiaal = a["Materiaalsoort(en)"];
    if (a.Kleur) specs.Kleur = a.Kleur;
    if (a.Vorm) specs.Vorm = a.Vorm;
    if (a["Tafelblad dikte"]) specs["Bladdikte"] = /cm|mm/.test(a["Tafelblad dikte"]) ? a["Tafelblad dikte"] : `${a["Tafelblad dikte"]} cm`;
    if (a.Afwerking) specs.Afwerking = a.Afwerking;
    if (a.Onderhoud) specs.Onderhoud = a.Onderhoud;
    if (a["EAN-code"]) specs.EAN = a["EAN-code"];
    specs.Artikelnummer = a.SKU ?? b.card.sku ?? "";
    const name = b.d.name || b.card.name;
    const group = groupOf.get(b) ?? null;
    const data = {
      name, description: b.d.description || `${name} — LivingFurn-collectie.`,
      price: b.card.price ?? 0, category: b.cat, images: JSON.stringify(uploaded), specs: JSON.stringify(specs),
      colorGroup: group, colorName: group ? b.kleur : null, colorHex: group && b.kleur ? COLOR_HEX[b.kleur.toLowerCase()] ?? null : null,
      source: SOURCE, hidden: true, stock: 10, deliveryTime: DELIVERY,
    };
    await prisma.product.upsert({ where: { slug: b.slug }, update: data, create: { slug: b.slug, ...data } });
    created++;
    if (created % 10 === 0) console.log(`  … ${created} aangemaakt`);
  }
  console.log(`\n✅ Klaar — ${created} producten aangemaakt (verborgen, prijs uit listing, source ${SOURCE}).`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
