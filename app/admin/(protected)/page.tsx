import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Package, Star, Tags } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [total, featured, byCategoryRaw] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { featured: true } }),
    prisma.product.groupBy({
      by: ["category"],
      _count: { _all: true },
      orderBy: { category: "asc" },
    }),
  ]);

  const recent = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, slug: true, name: true, price: true, updatedAt: true, category: true },
  });

  return (
    <div>
      <header className="mb-10">
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-2">Overzicht</p>
        <h1 className="font-serif text-4xl text-ink leading-none">Dashboard</h1>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Stat icon={<Package className="w-5 h-5" />} label="Producten" value={total} />
        <Stat icon={<Star className="w-5 h-5" />} label="Featured" value={featured} />
        <Stat icon={<Tags className="w-5 h-5" />} label="Categorieën" value={byCategoryRaw.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line">
          <div className="px-6 py-5 border-b border-line flex items-center justify-between">
            <h2 className="font-serif text-lg text-ink">Per categorie</h2>
            <Link href="/admin/products" className="text-[10px] uppercase tracking-[0.25em] text-stone hover:text-bronze">
              Alles bekijken
            </Link>
          </div>
          <ul>
            {byCategoryRaw.map((row) => (
              <li
                key={row.category}
                className="flex items-center justify-between px-6 py-3.5 border-b border-line last:border-b-0"
              >
                <Link
                  href={`/admin/products?category=${row.category}`}
                  className="text-sm text-ink capitalize hover:text-bronze"
                >
                  {row.category}
                </Link>
                <span className="text-[12px] text-stone tabular-nums">{row._count._all}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white border border-line">
          <div className="px-6 py-5 border-b border-line">
            <h2 className="font-serif text-lg text-ink">Recent gewijzigd</h2>
          </div>
          <ul>
            {recent.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-6 py-3.5 border-b border-line last:border-b-0 gap-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/products/${p.slug}`}
                    className="text-sm text-ink hover:text-bronze block truncate"
                  >
                    {p.name}
                  </Link>
                  <p className="text-[11px] text-stone capitalize mt-0.5">{p.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-serif text-ink tabular-nums">€{p.price.toFixed(2)}</p>
                  <p className="text-[10px] text-stone uppercase tracking-wider mt-0.5">
                    {formatRelativeDate(p.updatedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border border-line p-6">
      <div className="flex items-center gap-3 text-stone mb-3">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.25em]">{label}</span>
      </div>
      <p className="font-serif text-4xl text-ink leading-none tabular-nums">{value}</p>
    </div>
  );
}

function formatRelativeDate(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min}m geleden`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d geleden`;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
