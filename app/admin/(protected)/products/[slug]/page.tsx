import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import EditProductForm from "./EditProductForm";
import ImageManager from "@/components/admin/ImageManager";
import DeleteProductButton from "./DeleteProductButton";
import { parseAdminImages } from "../../_lib/images";
import { VALID_DB_CATEGORIES } from "../../_lib/db-categories";

export const dynamic = "force-dynamic";

function parseSpecs(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function parseSizeVariants(raw: string | null): { label: string; price?: number; listPrice?: number }[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((v) => {
      if (!v || typeof v !== "object" || typeof (v as { label?: unknown }).label !== "string") return [];
      const row = v as { label: string; price?: unknown; listPrice?: unknown };
      return [
        {
          label: row.label,
          ...(typeof row.price === "number" ? { price: row.price } : {}),
          ...(typeof row.listPrice === "number" ? { listPrice: row.listPrice } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

export default async function AdminProductEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [product, sourceRows] = await Promise.all([
    prisma.product.findUnique({ where: { slug } }),
    prisma.product.findMany({
      where: { source: { not: null }, deletedAt: null },
      distinct: ["source"],
      select: { source: true },
      orderBy: { source: "asc" },
    }),
  ]);
  if (!product) notFound();

  const images = parseAdminImages(product.images);
  // Geldige categorieën + de huidige (ook als die niet meer geldig is, zodat
  // het formulier 'm toont en de server bij opslaan een duidelijke fout geeft).
  const categories = Array.from(new Set([...VALID_DB_CATEGORIES, product.category])).sort();

  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 min-h-11 eyebrow-lg hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Terug naar producten
      </Link>

      <header className="mb-10 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="eyebrow-lg mb-2 capitalize">{product.category}</p>
          <h1 className="font-serif text-4xl text-ink leading-none">{product.name}</h1>
          {product.deletedAt && (
            <p className="text-sm text-error mt-2">Dit product staat in de prullenbak; herstel het eerst om te bewerken.</p>
          )}
        </div>
        {!product.deletedAt && <DeleteProductButton id={product.id} name={product.name} />}
      </header>

      <EditProductForm
        key={product.updatedAt.toISOString()}
        product={{
          id: product.id,
          updatedAt: product.updatedAt.toISOString(),
          slug: product.slug,
          name: product.name,
          description: product.description,
          price: product.price,
          listPrice: product.listPrice,
          nachtkastMode: product.nachtkastMode,
          nachtkastPrice: product.nachtkastPrice,
          nachtkastPrice2: product.nachtkastPrice2,
          voetbankMode: product.voetbankMode,
          voetbankPrice: product.voetbankPrice,
          category: product.category,
          featured: product.featured,
          hidden: product.hidden,
          specs: parseSpecs(product.specs),
          sizeVariants: parseSizeVariants(product.sizeVariants),
          stock: product.stock,
          deliveryTime: product.deliveryTime,
          colorGroup: product.colorGroup,
          colorName: product.colorName,
          colorHex: product.colorHex,
          source: product.source,
        }}
        categories={categories}
        validCategories={VALID_DB_CATEGORIES}
        sources={sourceRows.flatMap((s) => (s.source ? [s.source] : []))}
        imageCount={images.length}
        justSaved={sp.saved === "1"}
      />

      <section className="mt-12 pt-10 border-t border-line">
        <header className="mb-6">
          <p className="eyebrow-lg mb-1.5">Afbeeldingen</p>
          <h2 className="font-serif text-2xl text-ink leading-none">
            {images.length} foto{images.length === 1 ? "" : "'s"}
          </h2>
          <p className="text-base text-stone mt-2">
            Wijzigingen aan foto&rsquo;s worden direct opgeslagen. De eerste foto is de hoofdfoto op de
            productpagina en in lijsten. Vul per foto een korte alt-tekst in (wat er te zien is) voor
            toegankelijkheid en vindbaarheid.
          </p>
        </header>

        <ImageManager productId={product.id} category={product.category} slug={product.slug} initialImages={images} />
      </section>
    </div>
  );
}
