import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { firstImageOnly } from "@/lib/imageHelpers";
import { getCategory } from "@/lib/categories";
import { rateLimitIp } from "@/lib/rate-limit";

// Public listing-endpoint: korte cache OK (admin-mutaties zijn niet
// kritiek-real-time). s-maxage=60 = CDN cached 60s, stale-while-revalidate
// 300s = klant ziet altijd directe response terwijl achtergrond ververst.
export const dynamic = "force-dynamic";

const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  "alle-banken": "banken",
};

const MAX_TAKE = 1000;

// Alle query-parameters gevalideerd: `parseFloat` op vrije invoer gaf NaN of
// Infinity door aan Prisma, en een ongelimiteerde `contains`-scan op de
// beschrijving was een goedkope manier om de database te belasten.
const querySchema = z.object({
  category: z.string().trim().min(1).max(80).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "name"]).default("newest"),
  q: z.string().trim().min(1).max(80).optional(),
  minPrice: z.coerce.number().finite().min(0).max(999999).default(0),
  maxPrice: z.coerce.number().finite().min(0).max(999999).default(999999),
  limit: z.coerce.number().int().min(1).max(MAX_TAKE).default(MAX_TAKE),
  includeHidden: z.string().max(1).optional(),
});

/** Lege strings gelden als "niet opgegeven" (bv. `?q=&minPrice=`). */
function queryObject(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["category", "sort", "q", "minPrice", "maxPrice", "limit", "includeHidden"]) {
    const v = searchParams.get(key);
    if (v !== null && v.trim() !== "") out[key] = v;
  }
  return out;
}

function resolveCategoryFilter(
  category: string | undefined,
): string | { in: ReadonlyArray<string> } | null {
  if (!category) return null;
  const slug = LEGACY_CATEGORY_ALIASES[category] ?? category;
  const def = getCategory(slug);
  if (def?.isUmbrella) return { in: def.dbCategories };
  // Bekende sub-categorie of onbekende waarde: 1-op-1 op Product.category
  // (onbekende waarden geven gewoon een lege lijst, geen fout).
  return slug;
}

export async function GET(request: NextRequest) {
  const rl = await rateLimitIp("api-products", 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Te veel verzoeken. Probeer het zo opnieuw." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter), "Cache-Control": "no-store" } },
    );
  }

  const parsed = querySchema.safeParse(queryObject(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige zoekparameters" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const { category, sort, q, minPrice, maxPrice, limit } = parsed.data;

  // includeHidden alleen voor ingelogde admins — anonieme bezoekers mogen
  // verborgen (niet-gepubliceerde) producten nooit zien, ook niet via de query.
  const session = await auth();
  const includeHidden = parsed.data.includeHidden === "1" && Boolean(session?.user);

  const where: Record<string, unknown> = {};

  // Soft-deleted producten zijn nooit publiek zichtbaar (zitten in prullenbak)
  where.deletedAt = null;

  // Default: alleen niet-verborgen producten tonen
  if (!includeHidden) {
    where.hidden = false;
  }

  // Categorie-filter. Umbrella-slugs uit lib/categories.ts (banken, tafels,
  // stoelen, kasten, verlichting) worden uitgebreid naar hun `dbCategories`,
  // zodat `?category=tafels` ook eettafels/salontafels/bijzettafels teruggeeft.
  // "alle-banken" blijft als legacy-alias voor "banken" werken.
  const categoryFilter = resolveCategoryFilter(category);
  if (categoryFilter) where.category = categoryFilter;

  if (q) {
    // Alleen op naam (niet op de lange, niet-geïndexeerde beschrijving).
    // insensitive: Postgres 'contains' is standaard hoofdlettergevoelig —
    // "vanilla" zou "Vanilla Loop" anders niet vinden.
    where.name = { contains: q, mode: "insensitive" };
  }

  where.price = {
    gte: Math.min(minPrice, maxPrice),
    lte: Math.max(minPrice, maxPrice),
  };

  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (sort === "price-asc") orderBy = { price: "asc" };
  if (sort === "price-desc") orderBy = { price: "desc" };
  if (sort === "name") orderBy = { name: "asc" };

  // Expliciete select: alleen klant-velden. NOOIT interne kolommen als `source`
  // (groothandel-/dropship-leverancier) publiek teruggeven.
  const rows = await prisma.product.findMany({
    where,
    orderBy,
    take: limit,
    select: {
      id: true, slug: true, name: true, price: true, listPrice: true,
      category: true, images: true, featured: true, stock: true, createdAt: true,
      colorGroup: true, colorName: true, colorHex: true, specs: true,
    },
  });
  // Payload-trim: de listing-kaart toont alleen foto 1 — bij take:1000 scheelt
  // het weglaten van de overige image-URL's ~80% response-grootte.
  const products = rows.map((p) => ({ ...p, images: firstImageOnly(p.images) }));

  // Admin-respons (met verborgen producten) mag NOOIT in een gedeelde cache
  // (CDN) belanden en daarna aan anonieme bezoekers worden geserveerd.
  const headers: Record<string, string> = includeHidden
    ? { "Cache-Control": "private, no-store", Vary: "Cookie" }
    : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  return NextResponse.json({ products }, { headers });
}
