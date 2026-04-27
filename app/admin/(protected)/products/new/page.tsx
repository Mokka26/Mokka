import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import NewProductForm from "./NewProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await prisma.product.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });

  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-stone hover:text-bronze mb-6"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Terug naar producten
      </Link>

      <header className="mb-10">
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone mb-2">Catalogus</p>
        <h1 className="font-serif text-4xl text-ink leading-none">Nieuw product</h1>
      </header>

      <NewProductForm categories={categories.map((c) => c.category)} />
    </div>
  );
}
