import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCategory, type CategorySlug } from "@/lib/categories";
import { cldOptimize } from "@/lib/cloudinary-url";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { frameMode, parseImages, type ImageBackground } from "@/lib/imageHelpers";
import { getProductCounts } from "@/lib/product-counts";
import { PRODUCTS_TAG } from "@/lib/revalidate";
import { Tilt } from "@/components/home/Tilt";
import { stagger } from "@/components/home/motion";
import { CATEGORY_TILE_IMAGES } from "@/lib/home-scenes";

// Server component. Tellingen én tegelfoto's komen server-side uit de DB
// (gecachet op PRODUCTS_TAG) — geen client-fetch, geen stockfoto's. Per tegel
// de eerste sfeerfoto (bg "scene") van de nieuwste uitgelichte (anders
// nieuwste) zichtbare producten; zonder sfeerfoto de eerste productfoto.
// Categorieën zonder zichtbare producten worden niet getoond.
//
// Bento-raster: desktop 4 kolommen × 3 rijen (grote tegel 2×2), mobiel 2
// kolommen. Elke tegel kantelt in 3D op muisbeweging (Tilt) en verschijnt
// bij scrollen (.reveal) — beide alleen zonder "minder beweging".

const PRIMARY: ReadonlyArray<CategorySlug> = ["banken", "bedden"];
// Eetkamerstoelen vóór slaapkamers: het grootste assortiment hoort op home.
const SECONDARY: ReadonlyArray<CategorySlug> = [
  "eettafels",
  "eetkamerstoelen",
  "slaapkamers",
  "salontafels",
  "fauteuils",
  "kasten",
  "verlichting",
];
const MAX_SECONDARY = 4;

// Umbrella-labels in lib/categories zijn "Alle banken" e.d.; op een tegel is
// de korte vorm duidelijker.
const TILE_LABEL: Partial<Record<CategorySlug, string>> = {
  banken: "Banken",
  kasten: "Kasten",
  verlichting: "Verlichting",
};

// Plaats in het bento-raster per tegelpositie: span-klassen, sizes en beeldformaat.
const LAYOUT: ReadonlyArray<{ span: string; sizes: string; ar: string; w: number; big: boolean }> = [
  { span: "col-span-2 aspect-[4/3] lg:aspect-auto lg:row-span-2", sizes: "(max-width: 1024px) 100vw, 50vw", ar: "1:1", w: 1400, big: true },
  { span: "col-span-2 aspect-[4/3] lg:aspect-auto", sizes: "(max-width: 1024px) 100vw, 50vw", ar: "16:9", w: 1400, big: true },
  { span: "aspect-square lg:aspect-auto", sizes: "(max-width: 1024px) 50vw, 25vw", ar: "1:1", w: 800, big: false },
  { span: "aspect-square lg:aspect-auto", sizes: "(max-width: 1024px) 50vw, 25vw", ar: "1:1", w: 800, big: false },
  { span: "aspect-square lg:aspect-auto lg:col-span-2", sizes: "50vw", ar: "16:9", w: 1200, big: false },
  { span: "aspect-square lg:aspect-auto lg:col-span-2", sizes: "50vw", ar: "16:9", w: 1200, big: false },
];

type TileImage = { url: string; productName: string; bg?: ImageBackground };

const getCategoryImages = unstable_cache(
  async (slugs: ReadonlyArray<CategorySlug>): Promise<Record<string, TileImage>> => {
    const rows = await Promise.all(
      slugs.map(async (slug) => {
        const cat = getCategory(slug);
        if (!cat) return [slug, null] as const;
        const products = await prisma.product.findMany({
          where: { category: { in: [...cat.dbCategories] }, hidden: false, deletedAt: null },
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
          select: { name: true, images: true },
          take: 12,
        });
        const withFirst = products.map((p) => ({ name: p.name, first: parseImages(p.images)[0] }));
        const pick = withFirst.find((p) => p.first?.bg === "scene") ?? withFirst.find((p) => p.first);
        return [slug, pick?.first ? { url: pick.first.url, productName: pick.name, bg: pick.first.bg } : null] as const;
      }),
    );
    const out: Record<string, TileImage> = {};
    for (const [slug, img] of rows) if (img) out[slug] = img;
    return out;
  },
  ["category-tile-images-v2"],
  { tags: [PRODUCTS_TAG], revalidate: 3600 },
);

type Tile = {
  slug: CategorySlug;
  label: string;
  count: number;
  image: TileImage | null;
};

function buildTiles(
  slugs: ReadonlyArray<CategorySlug>,
  counts: Record<string, number>,
  images: Record<string, TileImage>,
): Tile[] {
  const tiles: Tile[] = [];
  for (const slug of slugs) {
    const cat = getCategory(slug);
    const count = counts[slug] ?? 0;
    if (!cat || count === 0) continue;
    const fixed = CATEGORY_TILE_IMAGES[slug];
    const image = fixed ? { ...fixed, bg: "scene" as const } : (images[slug] ?? null);
    tiles.push({ slug, label: TILE_LABEL[slug] ?? cat.label, count, image });
  }
  return tiles;
}

function countLabel(n: number): string {
  return n === 1 ? "1 product" : `${n} producten`;
}

function CategoryTile({ tile, index }: { tile: Tile; index: number }) {
  const layout = LAYOUT[index] ?? LAYOUT[LAYOUT.length - 1];
  const src = tile.image
    ? // Decoratief, onder de vouw: q_auto:eco en max. 1080 breed (zie CloudinaryImage maxWidth).
      cldOptimize(tile.image.url, { ar: layout.ar, w: layout.w, mode: frameMode(tile.image), quality: "auto:eco" })
    : null;

  return (
    // Buitenste laag: .reveal (scroll). Binnenste: Tilt. Beide gebruiken
    // transform, dus op aparte elementen.
    <div className={`${layout.span} reveal ${stagger(index % 4)}`}>
      <Tilt className="h-full">
        <Link
          href={`/${tile.slug}`}
          className="group relative block h-full rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          <div className="absolute inset-0 overflow-hidden rounded-[14px] bg-bone">
            <div className="absolute -inset-4 tilt-media">
              {src && tile.image && (
                <CloudinaryImage
                  src={src}
                  alt={`${tile.label}: ${tile.image.productName}`}
                  fill
                  sizes={layout.sizes}
                  maxWidth={1080}
                  className="object-cover"
                />
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/15 to-transparent" aria-hidden />
            <div className="absolute inset-0 tilt-glare pointer-events-none" aria-hidden />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8 flex items-end justify-between gap-4 text-white tilt-float">
            <div className="min-w-0">
              <h3
                className={`font-serif leading-[1.05] tracking-[-0.02em] ${
                  layout.big ? "text-3xl sm:text-4xl lg:text-5xl" : "text-xl sm:text-2xl lg:text-3xl"
                }`}
              >
                {tile.label}
              </h3>
              <p className="text-sm text-white/90 mt-1.5 tabular-nums">{countLabel(tile.count)}</p>
            </div>
            <span
              className="hidden sm:flex w-12 h-12 shrink-0 rounded-full bg-white/15 backdrop-blur-md border border-white/30 items-center justify-center transition-[background-color,color,transform] duration-500 group-hover:bg-white group-hover:text-ink group-hover:rotate-45"
              aria-hidden
            >
              <ArrowUpRight className="w-5 h-5" strokeWidth={1.5} />
            </span>
          </div>
        </Link>
      </Tilt>
    </div>
  );
}

export default async function CategoriesGrid() {
  let counts: Record<string, number> = {};
  let images: Record<string, TileImage> = {};
  try {
    [counts, images] = await Promise.all([
      getProductCounts(),
      getCategoryImages([...PRIMARY, ...SECONDARY]),
    ]);
  } catch {
    return null;
  }

  const tiles = [
    ...buildTiles(PRIMARY, counts, images),
    ...buildTiles(SECONDARY, counts, images).slice(0, MAX_SECONDARY),
  ];
  if (tiles.length === 0) return null;

  return (
    <section className="py-20 lg:py-32 bg-white" aria-labelledby="categories-heading">
      <div className="max-w-page mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end mb-12 lg:mb-16 reveal">
          <div className="lg:col-span-8">
            <p className="text-sm font-medium uppercase tracking-label text-accent-dark mb-4">
              Collectie
            </p>
            <h2 id="categories-heading" className="display-lg text-ink">
              Ontdek per categorie
            </h2>
          </div>
          <div className="lg:col-span-4 flex lg:justify-end">
            <Link href="/products" className="btn-link text-sm">
              Alle producten
              <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 lg:auto-rows-[clamp(15rem,20vw,19rem)] gap-3 sm:gap-5 lg:gap-6">
          {tiles.map((tile, i) => (
            <CategoryTile key={tile.slug} tile={tile} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
