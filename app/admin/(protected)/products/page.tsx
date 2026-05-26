import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ProductsTable from "./ProductsTable";
import SearchInput from "./SearchInput";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; source?: string }>;
}) {
  const params = await searchParams;
  const where: {
    category?: string;
    source?: string;
    OR?: { name?: { contains: string; mode: "insensitive" } }[];
    deletedAt: null;
  } = { deletedAt: null };
  if (params.category) where.category = params.category;
  if (params.source) where.source = params.source;
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
      hidden: true,
      source: true,
      images: true,
      updatedAt: true,
      stock: true,
    },
  });

  const categories = await prisma.product.groupBy({
    by: ["category"],
    where: { deletedAt: null },
    _count: { _all: true },
    orderBy: { category: "asc" },
  });

  const sources = await prisma.product.groupBy({
    by: ["source"],
    where: { deletedAt: null, source: { not: null } },
    _count: { _all: true },
    orderBy: { source: "asc" },
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
          className="inline-flex items-center gap-2 bg-ink text-white px-5 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nieuw product
        </Link>
      </header>

      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput />
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              href={buildHref({ source: params.source, q: params.q })}
              label="Alle"
              count={categories.reduce((s, c) => s + c._count._all, 0)}
              active={!params.category}
            />
            {categories.map((c) => (
              <Chip
                key={c.category}
                href={buildHref({ category: c.category, source: params.source, q: params.q })}
                label={c.category}
                count={c._count._all}
                active={params.category === c.category}
              />
            ))}
          </div>
        </div>

        {/* Bron-filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone mr-1">Bron</span>
          <Chip
            href={buildHref({ category: params.category, q: params.q })}
            label="Alle"
            count={sources.reduce((s, x) => s + x._count._all, 0)}
            active={!params.source}
          />
          {sources.map((x) => (
            <Chip
              key={x.source}
              href={buildHref({ category: params.category, source: x.source ?? undefined, q: params.q })}
              label={x.source ?? "—"}
              count={x._count._all}
              active={params.source === x.source}
            />
          ))}
        </div>
      </div>

      <ProductsTable products={products} />
    </div>
  );
}

function buildHref(next: { category?: string; source?: string; q?: string }): string {
  const sp = new URLSearchParams();
  if (next.category) sp.set("category", next.category);
  if (next.source) sp.set("source", next.source);
  if (next.q) sp.set("q", next.q);
  const qs = sp.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

function Chip({
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
          : "bg-white text-ink border-line hover:border-accent"
      }`}
    >
      {label} <span className="opacity-60 ml-1 tabular-nums">{count}</span>
    </Link>
  );
}
