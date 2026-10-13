import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";

export const dynamic = "force-dynamic";

/**
 * Overzicht van shop-categorieën met het aantal zichtbare producten. Per
 * categorie stel je de productvolgorde in (standaardsortering in de shop).
 * Umbrella's (bv. Banken) verwijzen door naar hun onderdelen.
 */
export default async function AdminCategoriesPage() {
  const counts = await prisma.product.groupBy({
    by: ["category"],
    where: { hidden: false, deletedAt: null },
    _count: { _all: true },
  });
  const countByDb = new Map(counts.map((c) => [c.category, c._count._all]));
  const visibleCount = (dbCategories: ReadonlyArray<string>) => dbCategories.reduce((sum, c) => sum + (countByDb.get(c) ?? 0), 0);

  const groups = Array.from(new Set(CATEGORIES.map((c) => c.group)));

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow-lg mb-2">Catalogus</p>
        <h1 className="font-serif text-4xl text-ink leading-none">Categorieën</h1>
        <p className="text-base text-stone mt-3 max-w-2xl">
          Kies een categorie om te bepalen welke producten als eerste staan op de categoriepagina.
        </p>
      </header>

      <div className="space-y-8">
        {groups.map((group) => {
          const cats = CATEGORIES.filter((c) => c.group === group);
          return (
            <section key={group} aria-labelledby={`group-${group}`}>
              <h2 id={`group-${group}`} className="eyebrow-lg mb-3">
                {group}
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cats.map((c) => {
                  const n = visibleCount(c.dbCategories);
                  return (
                    <li key={c.slug}>
                      <Link
                        href={`/admin/categories/${c.slug}`}
                        className="flex items-center justify-between gap-3 min-h-14 px-4 py-3 bg-white border border-line hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                      >
                        <span className="min-w-0">
                          <span className="block text-base text-ink font-medium truncate">{c.label}</span>
                          <span className="block text-sm text-stone tabular-nums">
                            {n} zichtbaar{c.isUmbrella ? " · samengesteld" : ""}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-stone" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
