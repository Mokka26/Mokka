import { prisma } from "@/lib/prisma";
import { Trash2 } from "lucide-react";
import { firstImageUrl } from "@/lib/imageHelpers";
import TrashClient from "./TrashClient";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;

export default async function TrashPage() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [products, images] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        images: true,
        deletedAt: true,
        price: true,
      },
    }),
    prisma.deletedImage.findMany({
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        productSlug: true,
        productId: true,
        url: true,
        deletedAt: true,
      },
    }),
  ]);

  const productItems = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    thumbnail: firstImageUrl(p.images),
    deletedAt: p.deletedAt!,
    autoPurgeAt: new Date(p.deletedAt!.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
  }));

  const imageItems = images.map((i) => ({
    id: i.id,
    productSlug: i.productSlug,
    productId: i.productId,
    url: i.url,
    deletedAt: i.deletedAt,
    autoPurgeAt: new Date(i.deletedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
  }));

  // Items die op punt staan verwijderd te worden
  const expiringSoon = [...productItems, ...imageItems].filter(
    (i) => i.autoPurgeAt.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000,
  ).length;

  return (
    <div>
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Trash2 className="w-5 h-5 text-stone" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone">Beheer</p>
        </div>
        <h1 className="font-serif text-4xl text-ink leading-none">Prullenbak</h1>
        <p className="text-sm text-stone mt-3">
          Items worden automatisch permanent verwijderd na {RETENTION_DAYS} dagen.
          {expiringSoon > 0 && (
            <span className="ml-2 text-red-700">
              · {expiringSoon} item{expiringSoon === 1 ? "" : "s"} binnenkort permanent weg
            </span>
          )}
        </p>
      </header>

      <TrashClient products={productItems} images={imageItems} cutoff={cutoff.toISOString()} />
    </div>
  );
}
