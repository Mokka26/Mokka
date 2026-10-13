import type { Metadata } from "next";
import { Suspense } from "react";
import { permanentRedirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { isCategorySlug } from "@/lib/categories";
import { businessInfo } from "@/lib/business-info";
import { prisma } from "@/lib/prisma";
import { firstImageOnly } from "@/lib/imageHelpers";
import { PRODUCTS_TAG } from "@/lib/revalidate";
import { dedupeByColorGroup } from "./dedupe";
import ProductsContent from "./ProductsContent";

export const revalidate = 3600;

// Kaarten per pagina. De catalogus (±1.200 producten) ging eerder in zijn
// geheel als RSC-payload naar de client (~600 kB); nu alleen de pagina die
// de bezoeker ziet (?page=N, server-side slice). Filters halen zelf via
// /api/products op (zie ProductsContent).
const PAGE_SIZE = 48;

// De ?category=-redirect maakt deze route per-request dynamisch, waardoor de
// volledige-catalogus-query anders bij ELKE bezoeker Neon zou raken. Cache de
// query daarom 1u (zelfde venster als de ISR-categoriepagina's) zodat 'ie
// hooguit 1×/uur draait i.p.v. per bezoek.
const getAllProducts = unstable_cache(
  async () => {
    const products = await prisma.product.findMany({
      where: { hidden: false, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, slug: true, name: true, price: true, listPrice: true, category: true,
        images: true, featured: true, stock: true, createdAt: true,
        deliveryTime: true, sizeVariants: true,
        colorGroup: true, colorName: true, colorHex: true, specs: true,
      },
    });
    // Payload-trim: kaart toont alleen foto 1 — rest van de images-JSON is
    // ballast in de flight-payload.
    // Kleurvarianten hier al samenvoegen, zodat de paginering op kaarten telt
    // en een kleurgroep nooit over twee pagina's verdeeld raakt.
    return dedupeByColorGroup(products.map((p) => ({ ...p, images: firstImageOnly(p.images) })));
  },
  ["all-products"],
  { tags: [PRODUCTS_TAG], revalidate: 3600 },
);

export const metadata: Metadata = {
  title: "Alle producten: het volledige assortiment",
  description: `Het volledige assortiment van ${businessInfo.name} in één overzicht: banken, eettafels, stoelen, kasten, bedden en verlichting. Filter op categorie, prijs of materiaal.`,
  alternates: { canonical: "/products" },
  // Totaaloverzicht is een hulpmiddel, geen landingspagina: de categorie-
  // pagina's zijn canoniek. Niet indexeren, wel links volgen; niet in de sitemap.
  robots: { index: false, follow: true },
  openGraph: {
    title: `Alle producten | ${businessInfo.name}`,
    description: `Het volledige assortiment van ${businessInfo.name} in één overzicht.`,
    type: "website",
    url: "/products",
    locale: "nl_NL",
  },
};

interface Props {
  searchParams: Promise<{ category?: string; page?: string }>;
}

function parsePage(raw: string | undefined, pageCount: number): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, pageCount);
}

/**
 * /products — overzicht "alle producten" (geen filter), 48 per pagina.
 *
 * Als ?category=X aanwezig → 301-redirect naar canonieke /<categorie>.
 * Speciale waarde "alle-banken" mapt naar /banken (umbrella).
 */
export default async function ProductsPage({ searchParams }: Props) {
  const { category, page: rawPage } = await searchParams;

  if (category) {
    const target = category === "alle-banken" ? "banken" : category;
    if (isCategorySlug(target)) {
      permanentRedirect(`/${target}`);
    }
  }

  // Server-side ophalen (gecached, zie getAllProducts) → de kaarten van deze
  // pagina staan in de SSR-HTML (LCP), geen client-fetch bij eerste load.
  const all = await getAllProducts();
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = parsePage(rawPage, pageCount);
  const initialProducts = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Suspense fallback={
      <div className="pt-28 lg:pt-32 pb-20">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-14 lg:mb-20">
          <div className="h-3 w-24 bg-bone animate-shimmer mb-4" />
          <div className="h-12 w-72 bg-bone animate-shimmer" />
        </div>
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="h-14 bg-bone animate-shimmer mb-10 lg:mb-14" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-12 sm:gap-x-4 sm:gap-y-14">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-square bg-white animate-shimmer" />
                <div className="h-3 w-3/4 bg-bone animate-shimmer" />
                <div className="h-3 w-1/3 bg-bone animate-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <ProductsContent
        initialProducts={initialProducts}
        page={page}
        pageCount={pageCount}
        total={all.length}
      />
    </Suspense>
  );
}
