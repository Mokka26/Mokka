import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/categories";
import { CategoryPageView, categoryMetadata } from "@/app/[category]/category-page";

/**
 * ISR-variant van de categoriepagina voor de kale URL (/eettafels zonder
 * query). proxy.ts herschrijft daarheen; bezoekers en Google zien gewoon
 * /eettafels (canonical ook). Zonder searchParams kan Next deze pagina
 * statisch cachen; de tag "products" ververst hem bij elke productwijziging.
 * Direct opvragen van /categorie-cache/... stuurt de proxy terug naar /<slug>.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  return categoryMetadata(category, {});
}

export default async function CachedCategoryPage({ params }: Props) {
  const { category } = await params;
  return <CategoryPageView categorySlug={category} sp={{}} />;
}
