// Diepgaande audit van verlichting-categorie:
//   Inventory, prijzen, foto-kwaliteit, slug-kwaliteit, colorGroups,
//   specs-completeness, performance impact, naming-conventies.

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

interface ParsedSpecs {
  Serie?: string;
  Categorie?: string;
  Afmetingen?: string;
  Materiaal?: string;
  Kleur?: string;
  Vermogen?: string;
  [k: string]: string | undefined;
}

function parseSpecs(s: string | null): ParsedSpecs {
  if (!s) return {};
  try {
    const o = JSON.parse(s);
    return typeof o === "object" && o ? o : {};
  } catch {
    return {};
  }
}

async function loadMeta() {
  const m = new Map<string, { bytes: number; width?: number; height?: number; format?: string }>();
  let cursor: string | undefined;
  do {
    const r = await cloudinary.api.resources({
      type: "upload", prefix: "mokka/verlichting", max_results: 500, next_cursor: cursor,
    } as Parameters<typeof cloudinary.api.resources>[0]);
    for (const i of r.resources) {
      m.set(i.public_id, { bytes: i.bytes ?? 0, width: i.width, height: i.height, format: i.format });
    }
    cursor = r.next_cursor;
  } while (cursor);
  return m;
}

function section(t: string) { console.log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`); }
function sub(t: string) { console.log(`\n─── ${t} ───`); }

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║  DIEPGAANDE AUDIT — VERLICHTING                                      ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");

  const allProducts = await prisma.product.findMany({
    where: { category: "verlichting" },
    select: {
      id: true, slug: true, name: true, description: true, price: true,
      stock: true, images: true, specs: true,
      colorGroup: true, colorName: true, colorHex: true,
      hidden: true, deletedAt: true, featured: true, createdAt: true,
    },
    orderBy: { slug: "asc" },
  });

  const active = allProducts.filter((p) => !p.deletedAt);
  const visible = active.filter((p) => !p.hidden);
  const hidden = active.filter((p) => p.hidden);
  const deleted = allProducts.filter((p) => p.deletedAt);
  const meta = await loadMeta();

  // ────────────────────────────────────────────────────────────────
  section("1. INVENTORY");
  console.log(`Totaal records:        ${allProducts.length}`);
  console.log(`Actief (niet-deleted): ${active.length}`);
  console.log(`  Zichtbaar:           ${visible.length}`);
  console.log(`  Verborgen:           ${hidden.length}`);
  console.log(`Soft-deleted:          ${deleted.length}`);
  const outOfStock = visible.filter((p) => p.stock === 0);
  const lowStock = visible.filter((p) => p.stock > 0 && p.stock <= 2);
  const featured = visible.filter((p) => p.featured);
  console.log(`\nVan zichtbaar:`);
  console.log(`  Uitverkocht:         ${outOfStock.length}`);
  console.log(`  Lage voorraad (≤2):  ${lowStock.length}`);
  console.log(`  Uitgelicht:          ${featured.length}`);

  // ────────────────────────────────────────────────────────────────
  section("2. PRIJZEN");
  const prices = visible.map((p) => p.price).sort((a, b) => a - b);
  if (prices.length > 0) {
    const min = prices[0];
    const max = prices[prices.length - 1];
    const med = prices[Math.floor(prices.length / 2)];
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    console.log(`Min:    €${min}`);
    console.log(`Mediaan: €${med}`);
    console.log(`Gem:    €${avg.toFixed(0)}`);
    console.log(`Max:    €${max}`);
    const zero = visible.filter((p) => p.price === 0);
    const veryHigh = visible.filter((p) => p.price > 2000);
    const suspect = visible.filter((p) => p.price < 50 && p.price > 0);
    if (zero.length > 0) console.log(`\n⚠ Prijs €0 (${zero.length}): ${zero.map(p => p.slug).slice(0, 5).join(", ")}`);
    if (veryHigh.length > 0) console.log(`⚠ Prijs >€2000 (${veryHigh.length}): ${veryHigh.map(p => p.slug).slice(0, 5).join(", ")}`);
    if (suspect.length > 0) console.log(`⚠ Prijs <€50 (${suspect.length}, verdacht laag voor verlichting): ${suspect.map(p => p.slug).slice(0, 5).join(", ")}`);
  }

  // ────────────────────────────────────────────────────────────────
  section("3. FOTO'S");
  const photoStats = { total: 0, avgPerProduct: 0, totalBytes: 0 };
  const noPhotos: string[] = [];
  const oneOnly: string[] = [];
  const placeholderPhotos: { slug: string; pid: string; kb: number }[] = [];
  const lowResPhotos: { slug: string; pid: string; dim: string }[] = [];
  const cropProblems: { slug: string; aspect: string }[] = [];

  for (const p of visible) {
    const imgs = parseImages(p.images);
    photoStats.total += imgs.length;
    if (imgs.length === 0) { noPhotos.push(p.slug); continue; }
    if (imgs.length === 1) oneOnly.push(p.slug);
    for (const img of imgs) {
      const pid = extractPublicId(img.url);
      if (!pid) continue;
      const m = meta.get(pid);
      if (!m) continue;
      photoStats.totalBytes += m.bytes;
      if (m.bytes < 30 * 1024) placeholderPhotos.push({ slug: p.slug, pid, kb: Math.round(m.bytes / 1024) });
      if (m.width && m.height && (m.width < 600 || m.height < 600))
        lowResPhotos.push({ slug: p.slug, pid, dim: `${m.width}×${m.height}` });
      if (m.width && m.height) {
        const r = m.width / m.height;
        if (r > 1.6 || r < 0.6) cropProblems.push({ slug: p.slug, aspect: r.toFixed(2) });
      }
    }
  }
  photoStats.avgPerProduct = photoStats.total / visible.length;

  console.log(`Totaal foto's:         ${photoStats.total}`);
  console.log(`Gem foto's/product:    ${photoStats.avgPerProduct.toFixed(2)}`);
  console.log(`Totaal Cloudinary MB:  ${(photoStats.totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`\nZonder foto:           ${noPhotos.length}${noPhotos.length > 0 ? ` (${noPhotos.slice(0, 3).join(", ")}${noPhotos.length > 3 ? "…" : ""})` : ""}`);
  console.log(`Slechts 1 foto:        ${oneOnly.length} (${oneOnly.length === visible.length ? "ALL — geen PDP-detailfoto's" : "rest heeft meer"})`);
  console.log(`Placeholder <30KB:     ${placeholderPhotos.length}`);
  console.log(`Lage resolutie <600px: ${lowResPhotos.length}`);
  console.log(`Sterke crop-risico's:  ${cropProblems.length} (aspect <0.6 of >1.6 — past niet in 3:2 card zonder pad/crop)`);

  // ────────────────────────────────────────────────────────────────
  section("4. COLORGROUPS");
  const withGroup = visible.filter((p) => p.colorGroup);
  const groups = new Map<string, typeof visible>();
  for (const p of withGroup) {
    const arr = groups.get(p.colorGroup!) ?? [];
    arr.push(p);
    groups.set(p.colorGroup!, arr);
  }
  console.log(`Met colorGroup:        ${withGroup.length}`);
  console.log(`Solo (geen group):     ${visible.length - withGroup.length}`);
  console.log(`Aantal groepen:        ${groups.size}`);
  const singletonGroups = Array.from(groups.entries()).filter(([, a]) => a.length === 1);
  if (singletonGroups.length > 0) {
    console.log(`\n⚠ Singleton groepen (colorGroup gezet maar geen partner):`);
    for (const [g, arr] of singletonGroups.slice(0, 10)) console.log(`  ${arr[0].slug}  (colorGroup: ${g})`);
  }
  sub("Groepen breakdown");
  const sortedGroups = Array.from(groups.entries()).filter(([, a]) => a.length > 1).sort((a, b) => b[1].length - a[1].length);
  for (const [g, arr] of sortedGroups) {
    const cols = arr.map((p) => p.colorName ?? "?").join(", ");
    console.log(`  ${arr.length}× ${g}  [${cols}]`);
  }

  // ────────────────────────────────────────────────────────────────
  section("5. SPECS (afmetingen, materiaal, kleur, vermogen)");
  const specCounts = {
    afmetingen: 0, materiaal: 0, kleur: 0, vermogen: 0, serie: 0,
  };
  for (const p of visible) {
    const s = parseSpecs(p.specs);
    if (s.Afmetingen) specCounts.afmetingen++;
    if (s.Materiaal) specCounts.materiaal++;
    if (s.Kleur) specCounts.kleur++;
    if (s.Vermogen) specCounts.vermogen++;
    if (s.Serie) specCounts.serie++;
  }
  const pct = (n: number) => `${n}/${visible.length} (${Math.round(n / visible.length * 100)}%)`;
  console.log(`Afmetingen:  ${pct(specCounts.afmetingen)}`);
  console.log(`Materiaal:   ${pct(specCounts.materiaal)}`);
  console.log(`Kleur:       ${pct(specCounts.kleur)}`);
  console.log(`Vermogen:    ${pct(specCounts.vermogen)}`);
  console.log(`Serie:       ${pct(specCounts.serie)}`);

  // ────────────────────────────────────────────────────────────────
  section("6. NAMEN & SLUGS");
  const longSlugs = visible.filter((p) => p.slug.length > 60);
  const shortNames = visible.filter((p) => p.name.length < 15);
  const longNames = visible.filter((p) => p.name.length > 60);
  const lowercaseNames = visible.filter((p) => p.name === p.name.toLowerCase());
  // Producten met "test", "tmp", "draft" in slug
  const sketchy = visible.filter((p) => /test|tmp|temp|draft|kopie|copy|dummy/i.test(p.slug));
  console.log(`Lange slugs (>60ch):   ${longSlugs.length}${longSlugs.length > 0 ? ` (worst: ${longSlugs[0]?.slug.slice(0, 60)}…)` : ""}`);
  console.log(`Korte namen (<15ch):   ${shortNames.length}${shortNames.length > 0 ? ` (eg: "${shortNames[0]?.name}")` : ""}`);
  console.log(`Lange namen (>60ch):   ${longNames.length}`);
  console.log(`Lowercase namen:       ${lowercaseNames.length}`);
  console.log(`Verdachte slug-keys:   ${sketchy.length}`);

  // ────────────────────────────────────────────────────────────────
  section("7. DESCRIPTIONS");
  const noDesc = visible.filter((p) => !p.description || p.description.length < 20);
  const longDesc = visible.filter((p) => p.description && p.description.length > 1000);
  const sameDesc = new Map<string, string[]>();
  for (const p of visible) {
    const key = (p.description ?? "").slice(0, 100);
    if (!key) continue;
    const arr = sameDesc.get(key) ?? [];
    arr.push(p.slug);
    sameDesc.set(key, arr);
  }
  const duplicated = Array.from(sameDesc.entries()).filter(([, a]) => a.length > 1);
  console.log(`Geen/te korte desc (<20ch): ${noDesc.length}`);
  console.log(`Lange desc (>1000ch):       ${longDesc.length}`);
  console.log(`Identieke description-start (eerste 100ch): ${duplicated.length} groepen`);
  for (const [desc, slugs] of duplicated.slice(0, 5)) {
    console.log(`  ${slugs.length}× "${desc.slice(0, 60)}…"`);
  }

  // ────────────────────────────────────────────────────────────────
  section("8. PERFORMANCE LISTING-PAGE (eerste 24 cards)");
  const first24 = visible.slice(0, 24);
  let listingBytes = 0;
  for (const p of first24) {
    const imgs = parseImages(p.images);
    if (imgs.length === 0) continue;
    const pid = extractPublicId(imgs[0].url);
    if (pid) {
      const m = meta.get(pid);
      if (m) listingBytes += m.bytes;
    }
  }
  console.log(`Bytes eerste 24 source-foto's: ${(listingBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Na cldOptimize (w=1200, q=auto:good, dpr=auto, f=auto):`);
  console.log(`  Mobile DPR 1: ~${Math.round(listingBytes / 1024 / 1024 * 0.15)} MB delivered`);
  console.log(`  Desktop DPR 2: ~${Math.round(listingBytes / 1024 / 1024 * 0.4)} MB delivered`);

  // ────────────────────────────────────────────────────────────────
  section("9. PRIJS-VOLUME PRODUCTEN (mogelijk wel handel-ruimte)");
  const popular = visible.filter((p) => p.featured);
  const topByPrice = [...visible].sort((a, b) => b.price - a.price).slice(0, 10);
  const bottomByPrice = [...visible].sort((a, b) => a.price - b.price).slice(0, 10);
  console.log(`Top 5 duurste:`);
  for (const p of topByPrice.slice(0, 5)) console.log(`  €${p.price}  ${p.slug}`);
  console.log(`\nGoedkoopste 5:`);
  for (const p of bottomByPrice.slice(0, 5)) console.log(`  €${p.price}  ${p.slug}`);
  console.log(`\nUitgelicht (featured): ${popular.length}`);

  // ────────────────────────────────────────────────────────────────
  section("10. AANBEVELINGEN");
  const recs: string[] = [];
  if (oneOnly.length === visible.length) recs.push(`📷 Alle ${visible.length} producten hebben maar 1 foto. PDP toont alleen hero — geen detail/zoom-foto's. Overweeg multi-photo voor top-sellers.`);
  if (placeholderPhotos.length > 0) recs.push(`🖼️ ${placeholderPhotos.length} foto's zijn placeholder-formaat (<30KB). Re-upload via /admin met echte product-foto.`);
  if (specCounts.afmetingen < visible.length / 2) recs.push(`📐 Slechts ${specCounts.afmetingen}/${visible.length} (${Math.round(specCounts.afmetingen / visible.length * 100)}%) hebben Afmetingen-spec. Card toont dit blok als belangrijke info — vul aan via /admin.`);
  if (specCounts.vermogen === 0) recs.push(`💡 0 producten hebben "Vermogen" spec ingevuld (LED-watts). Belangrijk voor verlichting-koop-beslissing.`);
  if (noDesc.length > 0) recs.push(`📝 ${noDesc.length} producten zonder beschrijving (<20 chars). SEO-impact + onduidelijk voor klant.`);
  if (duplicated.length > 0) recs.push(`📋 ${duplicated.length} groepen producten delen identieke description-prefix. Mogelijk template-copy — review of dat OK is.`);
  if (singletonGroups.length > 0) recs.push(`🎨 ${singletonGroups.length} producten hebben colorGroup zonder partner (singleton). Swatches op listing tonen niets nuttigs. Clear of group toevoegen.`);
  if (cropProblems.length > 0) recs.push(`✂️ ${cropProblems.length} foto's hebben extreme aspect ratio (<0.6 of >1.6) — passen niet in 3:2 card zonder zware pad/crop.`);
  if (outOfStock.length > 0) recs.push(`📦 ${outOfStock.length} uitverkocht-producten zichtbaar op listing. Optioneel: hide of toon levertijd.`);

  if (recs.length === 0) {
    console.log("✓ Geen kritieke issues. Verlichting is gezond.");
  } else {
    for (const [i, r] of recs.entries()) console.log(`  ${i + 1}. ${r}`);
  }

  console.log("\n");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
