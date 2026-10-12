import type { Prisma } from "@prisma/client";

/** Statusfilters in de productlijst en op het dashboard. */
export const PRODUCT_STATUS_FILTERS = [
  "all",
  "visible",
  "hidden",
  "no-photo",
  "no-price",
  "out-of-stock",
  "featured",
] as const;
export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

export const PRODUCT_STATUS_LABEL: Record<ProductStatusFilter, string> = {
  all: "Alle",
  visible: "Zichtbaar",
  hidden: "Verborgen",
  "no-photo": "Zonder foto",
  "no-price": "Prijs 0",
  "out-of-stock": "Uitverkocht",
  featured: "Uitgelicht",
};

export function isProductStatusFilter(v: string | undefined): v is ProductStatusFilter {
  return !!v && (PRODUCT_STATUS_FILTERS as readonly string[]).includes(v);
}

/**
 * "Zonder foto" = de images-JSON bevat geen enkele URL. De kolom is een
 * JSON-string, dus we kijken op tekstniveau: geen "http" → geen foto.
 */
export function productStatusWhere(status: ProductStatusFilter): Prisma.ProductWhereInput {
  switch (status) {
    case "visible":
      return { hidden: false };
    case "hidden":
      return { hidden: true };
    case "no-photo":
      return { NOT: { images: { contains: "http" } } };
    case "no-price":
      return { price: { lte: 0 } };
    case "out-of-stock":
      return { stock: { lte: 0 } };
    case "featured":
      return { featured: true };
    default:
      return {};
  }
}

export const PRODUCT_SORTS = ["name", "price", "stock", "updatedAt"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABEL: Record<ProductSort, string> = {
  name: "Naam",
  price: "Prijs",
  stock: "Voorraad",
  updatedAt: "Bijgewerkt",
};

export function isProductSort(v: string | undefined): v is ProductSort {
  return !!v && (PRODUCT_SORTS as readonly string[]).includes(v);
}

export type ProductListParams = {
  status: ProductStatusFilter;
  category?: string;
  source?: string;
  q?: string;
  sort: ProductSort;
  dir: "asc" | "desc";
  page: number;
};

export const PRODUCT_PAGE_SIZE = 50;

export function parseProductListParams(sp: Record<string, string | string[] | undefined>): ProductListParams {
  const get = (k: string): string | undefined => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const status = get("status");
  const sort = get("sort");
  const dir = get("dir");
  const pageRaw = Number(get("page") ?? "1");
  return {
    status: isProductStatusFilter(status) ? status : "all",
    category: get("category"),
    source: get("source"),
    q: get("q")?.slice(0, 100),
    sort: isProductSort(sort) ? sort : "name",
    dir: dir === "desc" ? "desc" : "asc",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function productListWhere(p: ProductListParams): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ deletedAt: null }, productStatusWhere(p.status)];
  if (p.category) and.push({ category: p.category });
  if (p.source) and.push({ source: p.source });
  if (p.q) {
    and.push({
      OR: [
        { name: { contains: p.q, mode: "insensitive" } },
        { slug: { contains: p.q, mode: "insensitive" } },
        { colorGroup: { contains: p.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}

export function productListHref(p: Partial<ProductListParams>): string {
  const sp = new URLSearchParams();
  if (p.status && p.status !== "all") sp.set("status", p.status);
  if (p.category) sp.set("category", p.category);
  if (p.source) sp.set("source", p.source);
  if (p.q) sp.set("q", p.q);
  if (p.sort && p.sort !== "name") sp.set("sort", p.sort);
  if (p.dir && p.dir !== "asc") sp.set("dir", p.dir);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const qs = sp.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}
