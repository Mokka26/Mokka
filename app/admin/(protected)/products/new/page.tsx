import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import NewProductForm from "./NewProductForm";
import { VALID_DB_CATEGORIES } from "../../_lib/db-categories";

export const dynamic = "force-dynamic";

export default function NewProductPage() {
  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 min-h-11 eyebrow-lg hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent mb-4"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Terug naar producten
      </Link>

      <header className="mb-10">
        <p className="eyebrow-lg mb-2">Catalogus</p>
        <h1 className="font-serif text-4xl text-ink leading-none">Nieuw product</h1>
      </header>

      <NewProductForm categories={[...VALID_DB_CATEGORIES]} />
    </div>
  );
}
