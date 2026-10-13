import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCategory, CATEGORIES } from "@/lib/categories";
import { cldOptimize } from "@/lib/cloudinary-url";
import { frameMode, parseImages } from "@/lib/imageHelpers";
import { CategoryOrderEditor, type OrderProduct } from "../CategoryOrderEditor";

export const dynamic = "force-dynamic";

export default async function AdminCategoryOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  // Umbrella (bv. banken = hoekbanken + bankstellen): de volgorde zet je per
  // sub-categorie, want de shop toont de groepen in vaste volgorde.
  if (category.isUmbrella) {
    const children = CATEGORIES.filter((c) => c.parent === category.slug);
    return (
      <div>
        <BackLink />
        <h1 className="font-serif text-4xl text-ink leading-none mb-4">{category.label}</h1>
        <p className="text-base text-stone max-w-2xl mb-6">
          Deze pagina combineert meerdere categorieën. Zet de volgorde per onderdeel; de shop toont de groepen in deze volgorde.
        </p>
        <ul className="flex flex-wrap gap-3">
          {children.map((c) => (
            <li key={c.slug}>
              <Link href={`/admin/categories/${c.slug}`} className="inline-flex items-center min-h-11 px-4 border border-line bg-white hover:border-accent text-ink">
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Zelfde volgorde als de categoriepagina in de shop.
  const products = await prisma.product.findMany({
    where: { category: { in: [...category.dbCategories] }, hidden: false, deletedAt: null },
    select: { id: true, slug: true, name: true, price: true, images: true, featured: true, sortOrder: true },
    orderBy: [{ sortOrder: { sort: "asc", nulls: "last" } }, { featured: "desc" }, { createdAt: "desc" }],
  });

  const initial: OrderProduct[] = products.map((p) => {
    const img = parseImages(p.images)[0];
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price,
      featured: p.featured,
      thumb: img ? cldOptimize(img.url, { ar: "1:1", w: 112, mode: frameMode(img) }) : null,
      editHref: `/admin/products/${p.slug}`,
    };
  });
  const hasManualOrder = products.some((p) => p.sortOrder !== null);

  return (
    <div>
      <BackLink />
      <header className="mb-6">
        <p className="eyebrow-lg mb-2">Volgorde in de shop</p>
        <h1 className="font-serif text-4xl text-ink leading-none">{category.label}</h1>
        <p className="text-base text-stone mt-3 max-w-2xl">
          Dit is de volgorde op <Link href={`/${category.slug}`} className="underline underline-offset-4 hover:text-accent" target="_blank" rel="noopener noreferrer">/{category.slug}</Link> bij de standaardsortering. Zet een product bovenaan of omhoog/omlaag met de pijltjes, of typ een positienummer. Klik daarna op &ldquo;Volgorde opslaan&rdquo;.
        </p>
      </header>
      <CategoryOrderEditor slug={category.slug} label={category.label} initial={initial} hasManualOrder={hasManualOrder} />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/categories" className="inline-flex items-center gap-2 min-h-11 eyebrow-lg hover:text-accent mb-4">
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
      Alle categorieën
    </Link>
  );
}
