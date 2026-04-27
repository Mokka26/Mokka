import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import EditProductForm from "./EditProductForm";
import ImageManager from "@/components/admin/ImageManager";
import DeleteProductButton from "./DeleteProductButton";

export const dynamic = "force-dynamic";

function parseImages(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseSpecs(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === "string" && typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) notFound();

  const categories = await prisma.product.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });

  const images = parseImages(product.images);

  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-stone hover:text-bronze mb-6"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Terug naar producten
      </Link>

      <header className="mb-10 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-2 capitalize">
            {product.category}
          </p>
          <h1 className="font-serif text-4xl text-ink leading-none">{product.name}</h1>
        </div>
        <DeleteProductButton id={product.id} name={product.name} />
      </header>

      <EditProductForm
        product={{
          id: product.id,
          slug: product.slug,
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          featured: product.featured,
          specs: parseSpecs(product.specs),
        }}
        categories={categories.map((c) => c.category)}
      />

      <section className="mt-12 pt-10 border-t border-line">
        <header className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-1.5">
            Afbeeldingen
          </p>
          <h2 className="font-serif text-2xl text-ink leading-none">
            {images.length} foto{images.length === 1 ? "" : "'s"}
          </h2>
          <p className="text-[12px] text-stone mt-2">
            Wijzigingen worden direct opgeslagen. De eerste foto is de hoofdfoto op de productpagina en in lijsten.
          </p>
        </header>

        <ImageManager
          productId={product.id}
          category={product.category}
          slug={product.slug}
          initialImages={images}
        />
      </section>
    </div>
  );
}
