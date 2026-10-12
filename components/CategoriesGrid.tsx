import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCategory, type CategorySlug } from "@/lib/categories";
import { cldOptimize } from "@/lib/cloudinary-url";
import { CloudinaryImage } from "@/components/ui/CloudinaryImage";
import { firstImageUrl } from "@/lib/imageHelpers";
import { getProductCounts } from "@/lib/product-counts";
import { PRODUCTS_TAG } from "@/lib/revalidate";

// Server component. Tellingen én tegelfoto's komen server-side uit de DB
// (gecachet op PRODUCTS_TAG) — geen client-fetch, geen "—" tot hydratie, geen
// stockfoto's: elke tegel toont de eerste foto van het nieuwste uitgelichte
// (anders nieuwste) zichtbare product uit die categorie. Categorieën zonder
// zichtbare producten worden niet getoond.

const PRIMARY: ReadonlyArray<CategorySlug> = ["banken", "bedden"];
const SECONDARY: ReadonlyArray<CategorySlug> = [
  "eettafels",
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

type TileImage = { url: string; productName: string };

const getCategoryImages = unstable_cache(
  async (slugs: ReadonlyArray<CategorySlug>): Promise<Record<string, TileImage>> => {
    const rows = await Promise.all(
      slugs.map(async (slug) => {
        const cat = getCategory(slug);
        if (!cat) return [slug, null] as const;
        const product = await prisma.product.findFirst({
          where: { category: { in: [...cat.dbCategories] }, hidden: false, deletedAt: null },
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
          select: { name: true, images: true },
        });
        const url = product ? firstImageUrl(product.images) : null;
        return [slug, url && product ? { url, productName: product.name } : null] as const;
      }),
    );
    const out: Record<string, TileImage> = {};
    for (const [slug, img] of rows) if (img) out[slug] = img;
    return out;
  },
  ["category-tile-images"],
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
    tiles.push({ slug, label: TILE_LABEL[slug] ?? cat.label, count, image: images[slug] ?? null });
  }
  return tiles;
}

function countLabel(n: number): string {
  return n === 1 ? "1 product" : `${n} producten`;
}

function CategoryTile({ tile, primary }: { tile: Tile; primary: boolean }) {
  const ar = primary ? "4:3" : "1:1";
  const src = tile.image
    ? cldOptimize(tile.image.url, { ar, w: primary ? 1200 : 640, mode: "contain" })
    : null;

  return (
    <Link
      href={`/${tile.slug}`}
      className="group block rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <div
        className={`relative overflow-hidden rounded-[10px] bg-bone ${
          primary ? "aspect-[4/3]" : "aspect-square"
        }`}
      >
        {src && tile.image && (
          <CloudinaryImage
            src={src}
            alt={`${tile.label} — ${tile.image.productName}`}
            fill
            sizes={
              primary
                ? "(max-width: 1024px) 100vw, 50vw"
                : "(max-width: 1024px) 50vw, 25vw"
            }
            className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3
            className={`font-serif text-ink leading-tight ${
              primary ? "text-3xl lg:text-4xl" : "text-xl lg:text-2xl"
            }`}
          >
            {tile.label}
          </h3>
          <p className="text-sm text-slate mt-1 tabular-nums">{countLabel(tile.count)}</p>
        </div>
        <span
          className="w-11 h-11 shrink-0 rounded-full border border-line text-ink flex items-center justify-center transition-colors group-hover:bg-accent group-hover:border-accent group-hover:text-white"
          aria-hidden
        >
          <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
        </span>
      </div>
    </Link>
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

  const primaries = buildTiles(PRIMARY, counts, images);
  const secondaries = buildTiles(SECONDARY, counts, images).slice(0, MAX_SECONDARY);
  if (primaries.length === 0 && secondaries.length === 0) return null;

  return (
    <section className="py-20 lg:py-32 bg-white" aria-labelledby="categories-heading">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end mb-12 lg:mb-16">
          <div className="lg:col-span-8">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-accent-dark mb-4">
              Collectie
            </p>
            <h2 id="categories-heading" className="display-md text-ink">
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

        {primaries.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-10 lg:mb-12">
            {primaries.map((tile) => (
              <CategoryTile key={tile.slug} tile={tile} primary />
            ))}
          </div>
        )}

        {secondaries.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {secondaries.map((tile) => (
              <CategoryTile key={tile.slug} tile={tile} primary={false} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
