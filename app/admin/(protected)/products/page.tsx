import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { firstImageUrl } from "@/lib/imageHelpers";
import { Pagination } from "@/components/admin/Pagination";
import ProductsTable from "./ProductsTable";
import SearchInput from "./SearchInput";
import {
  PRODUCT_PAGE_SIZE,
  PRODUCT_SORTS,
  PRODUCT_SORT_LABEL,
  PRODUCT_STATUS_FILTERS,
  PRODUCT_STATUS_LABEL,
  parseProductListParams,
  productListHref,
  productListWhere,
  productStatusWhere,
} from "../_lib/product-filters";
import { VALID_DB_CATEGORIES } from "../_lib/db-categories";

export const dynamic = "force-dynamic";

const selectCls =
  "min-h-11 px-3 py-2 bg-white border border-line text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseProductListParams(await searchParams);
  const where = productListWhere(params);

  const [total, products, categories, sources, statusCounts] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ [params.sort]: params.dir }, { name: "asc" }],
      skip: (params.page - 1) * PRODUCT_PAGE_SIZE,
      take: PRODUCT_PAGE_SIZE,
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
    }),
    prisma.product.groupBy({
      by: ["category"],
      where: { deletedAt: null },
      _count: { _all: true },
      orderBy: { category: "asc" },
    }),
    prisma.product.groupBy({
      by: ["source"],
      where: { deletedAt: null, source: { not: null } },
      _count: { _all: true },
      orderBy: { source: "asc" },
    }),
    Promise.all(
      PRODUCT_STATUS_FILTERS.map(async (s) => ({
        status: s,
        count: await prisma.product.count({ where: { AND: [{ deletedAt: null }, productStatusWhere(s)] } }),
      })),
    ),
  ]);

  const rows = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    category: p.category,
    featured: p.featured,
    hidden: p.hidden,
    source: p.source,
    thumb: firstImageUrl(p.images),
    updatedAt: p.updatedAt.toISOString(),
    stock: p.stock,
  }));

  // Categorie-opties: geldige DB-categorieën + wat nu nog in de DB staat.
  const categoryOptions = Array.from(new Set([...VALID_DB_CATEGORIES, ...categories.map((c) => c.category)])).sort();
  const countByCategory = new Map(categories.map((c) => [c.category, c._count._all]));

  return (
    <div>
      <header className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-2">Catalogus</p>
          <h1 className="font-serif text-4xl text-ink leading-none">Producten</h1>
          <p className="text-base text-stone mt-3 tabular-nums">
            {total} resultaat{total === 1 ? "" : "en"}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 min-h-11 bg-ink text-white px-5 py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nieuw product
        </Link>
      </header>

      {/* Statusfilters */}
      <nav aria-label="Statusfilter" className="flex flex-wrap items-center gap-2 mb-4">
        {statusCounts.map(({ status, count }) => (
          <Link
            key={status}
            href={productListHref({ ...params, status, page: 1 })}
            aria-current={params.status === status ? "page" : undefined}
            className={`inline-flex items-center min-h-11 px-3.5 text-[11px] uppercase tracking-[0.2em] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              params.status === status ? "bg-ink text-white border-ink" : "bg-white text-ink border-line hover:border-accent"
            }`}
          >
            {PRODUCT_STATUS_LABEL[status]} <span className="opacity-60 ml-1.5 tabular-nums">{count}</span>
          </Link>
        ))}
      </nav>

      {/* Categorie / bron / sortering (GET-formulier, werkt zonder JS) */}
      <form method="get" action="/admin/products" className="flex flex-wrap items-end gap-3 mb-6">
        {params.status !== "all" && <input type="hidden" name="status" value={params.status} />}
        <SearchInput />
        <div>
          <label htmlFor="f-category" className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-1.5">
            Categorie
          </label>
          <select id="f-category" name="category" defaultValue={params.category ?? ""} className={selectCls}>
            <option value="">Alle categorieën</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
                {countByCategory.has(c) ? ` (${countByCategory.get(c)})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-source" className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-1.5">
            Bron
          </label>
          <select id="f-source" name="source" defaultValue={params.source ?? ""} className={selectCls}>
            <option value="">Alle bronnen</option>
            {sources.map((s) => (
              <option key={s.source ?? ""} value={s.source ?? ""}>
                {s.source} ({s._count._all})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-sort" className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-1.5">
            Sorteren
          </label>
          <select id="f-sort" name="sort" defaultValue={params.sort} className={selectCls}>
            {PRODUCT_SORTS.map((s) => (
              <option key={s} value={s}>{PRODUCT_SORT_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-dir" className="block text-[10px] uppercase tracking-[0.25em] text-stone mb-1.5">
            Volgorde
          </label>
          <select id="f-dir" name="dir" defaultValue={params.dir} className={selectCls}>
            <option value="asc">Oplopend</option>
            <option value="desc">Aflopend</option>
          </select>
        </div>
        <button
          type="submit"
          className="min-h-11 px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] border border-ink text-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
        >
          Toepassen
        </button>
        {(params.category || params.source || params.q || params.status !== "all") && (
          <Link
            href="/admin/products"
            className="inline-flex items-center min-h-11 px-3 text-[11px] uppercase tracking-[0.2em] text-stone hover:text-ink underline-offset-4 hover:underline"
          >
            Filters wissen
          </Link>
        )}
      </form>

      <ProductsTable
        products={rows}
        categories={categoryOptions}
        sort={params.sort}
        dir={params.dir}
        sortHrefs={Object.fromEntries(
          PRODUCT_SORTS.map((s) => [
            s,
            productListHref({ ...params, sort: s, dir: params.sort === s && params.dir === "asc" ? "desc" : "asc", page: 1 }),
          ]),
        )}
      />

      <Pagination
        page={params.page}
        pageSize={PRODUCT_PAGE_SIZE}
        total={total}
        label="producten"
        hrefFor={(p) => productListHref({ ...params, page: p })}
      />
    </div>
  );
}
