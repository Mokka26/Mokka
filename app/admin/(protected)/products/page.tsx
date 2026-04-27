import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ProductsTable from "./ProductsTable";
import SearchInput from "./SearchInput";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const where: { category?: string; OR?: { name?: { contains: string; mode: "insensitive" } }[] } = {};
  if (params.category) where.category = params.category;
  if (params.q) {
    where.OR = [{ name: { contains: params.q, mode: "insensitive" } }];
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      price: true,
      category: true,
      featured: true,
      images: true,
      updatedAt: true,
    },
  });

  const categories = await prisma.product.groupBy({
    by: ["category"],
    _count: { _all: true },
    orderBy: { category: "asc" },
  });

  return (
    <div>
      <header className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-2">Catalogus</p>
          <h1 className="font-serif text-4xl text-ink leading-none">Producten</h1>
          <p className="text-sm text-stone mt-3">
            {products.length} resultaat{products.length === 1 ? "" : "en"}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 bg-ink text-white px-5 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-bronze transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nieuw product
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SearchInput />
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip
            href={buildHref(undefined, params.q)}
            label="Alle"
            count={categories.reduce((s, c) => s + c._count._all, 0)}
            active={!params.category}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.category}
              href={buildHref(c.category, params.q)}
              label={c.category}
              count={c._count._all}
              active={params.category === c.category}
            />
          ))}
        </div>
      </div>

      <ProductsTable products={products} />
    </div>
  );
}

function buildHref(category?: string, q?: string): string {
  const sp = new URLSearchParams();
  if (category) sp.set("category", category);
  if (q) sp.set("q", q);
  const qs = sp.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

function CategoryChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3.5 py-1.5 text-[11px] uppercase tracking-[0.2em] border transition-colors ${
        active
          ? "bg-ink text-white border-ink"
          : "bg-white text-ink border-line hover:border-bronze"
      }`}
    >
      {label} <span className="opacity-60 ml-1 tabular-nums">{count}</span>
    </Link>
  );
}
