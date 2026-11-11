import type { Metadata } from "next";
import { CategoryPageView, categoryMetadata, type SearchParams } from "./category-page";

// Dynamische variant: filters, sortering en ?page=. De kale URL zonder query
// wordt door proxy.ts naar de ISR-variant (app/categorie-cache) herschreven.

interface Props {
  params: Promise<{ category: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ category }, sp] = await Promise.all([params, searchParams]);
  return categoryMetadata(category, sp);
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ category }, sp] = await Promise.all([params, searchParams]);
  return <CategoryPageView categorySlug={category} sp={sp} />;
}
