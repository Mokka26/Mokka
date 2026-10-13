import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import CategoriesGrid from "@/components/CategoriesGrid";
import CollectionPreview from "@/components/CollectionPreview";
import FeaturedStory from "@/components/FeaturedStory";
import ShowroomSection from "@/components/ShowroomSection";
import DarkNewsletterForm from "@/components/DarkNewsletterForm";
import { prisma } from "@/lib/prisma";
import { businessInfo } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";
import { getCategory } from "@/lib/categories";
import { ogDefaults } from "@/lib/seo";
import { PRODUCTS_TAG } from "@/lib/revalidate";

// ISR: alle homepage-data zit in unstable_cache op PRODUCTS_TAG, dus een
// productmutatie in de admin ververst de pagina direct; anders max. 1 uur oud.
export const revalidate = 3600;

const city = businessInfo.address.city;
// Absolute title (geen template): 60 tekens bij "Den Haag", één keer de
// merknaam, geen "&". Bij een andere plaatsnaam opnieuw meten (max. 60).
const title = `Meubels en verlichting kopen, showroom ${city} | ${businessInfo.name}`;
const description = `Banken, eettafels en bedden. Bestel online of bekijk de collectie in onze showroom in ${city}: ${shippingInfo.freeShippingCopyShort.toLowerCase()} en alle prijzen incl. btw.`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  ...ogDefaults({ title, description, url: "/" }),
};

// Alleen de velden die ProductCard toont; slug/description voor FeaturedStory.
const cardSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  listPrice: true,
  category: true,
  images: true,
  featured: true,
  stock: true,
  createdAt: true,
  colorGroup: true,
  colorName: true,
  colorHex: true,
  specs: true,
} as const;

const visibleWhere = { hidden: false, deletedAt: null } as const;
const MIN_FEATURED = 4;

type Collection = {
  kind: "featured" | "new";
  products: Array<{
    id: string;
    slug: string;
    name: string;
    price: number;
    listPrice: number | null;
    category: string;
    images: string;
    featured: boolean;
    stock: number;
    createdAt: Date | string;
    colorGroup: string | null;
    colorName: string | null;
    colorHex: string | null;
    specs: string | null;
  }>;
};

// Uitgelichte producten; zijn dat er te weinig voor een volle rij, dan de
// nieuwste zichtbare producten ("Nieuw binnen").
const getCollection = unstable_cache(
  async (): Promise<Collection> => {
    const featured = await prisma.product.findMany({
      where: { ...visibleWhere, featured: true },
      select: cardSelect,
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    if (featured.length >= MIN_FEATURED) return { kind: "featured", products: featured };

    const newest = await prisma.product.findMany({
      where: visibleWhere,
      select: cardSelect,
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    return { kind: "new", products: newest };
  },
  ["home-collection"],
  { tags: [PRODUCTS_TAG], revalidate: 3600 },
);

// Spotlight: nieuwste uitgelichte bank uit álle bank-DB-categorieën
// (banken, hoekbanken, bankstellen — zie lib/categories "banken").
const BANK_DB_CATEGORIES = [...(getCategory("banken")?.dbCategories ?? ["banken"])];

const getSpotlightProduct = unstable_cache(
  async () =>
    prisma.product.findFirst({
      where: { ...visibleWhere, featured: true, category: { in: BANK_DB_CATEGORIES } },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        listPrice: true,
        category: true,
        images: true,
        stock: true,
        deliveryTime: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ["home-spotlight"],
  { tags: [PRODUCTS_TAG], revalidate: 3600 },
);

async function loadHomepageData() {
  try {
    return await Promise.all([getCollection(), getSpotlightProduct()]);
  } catch {
    // DB tijdelijk onbereikbaar: toon de statische secties, geen 500.
    return [{ kind: "featured", products: [] } satisfies Collection, null] as const;
  }
}

export default async function HomePage() {
  const [collection, spotlightProduct] = await loadHomepageData();

  return (
    <>
      {/* 01 — HERO: zichtbare H1, next/image priority (LCP) */}
      <Hero />

      {/* 02 — TRUST BAR: USP's uit lib/shipping-info, direct onder de fold */}
      <TrustBar />

      {/* 03 — CATEGORIEËN: server-side tellingen + productfoto's */}
      <CategoriesGrid />

      {/* 04 — UITGELICHT / NIEUW BINNEN */}
      <CollectionPreview
        products={collection.products}
        title={collection.kind === "featured" ? "Uitgelicht" : "Nieuw binnen"}
        eyebrow={collection.kind === "featured" ? "Onze selectie" : "Net binnengekomen"}
      />

      {/* 05 — SPOTLIGHT (bank) */}
      <FeaturedStory product={spotlightProduct} />

      {/* 06 — SHOWROOM */}
      <ShowroomSection />

      {/* 07 — NIEUWSBRIEF */}
      <section className="py-20 lg:py-32 bg-ink text-white" aria-labelledby="newsletter-heading">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="max-w-xl mx-auto text-center">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-accent-light mb-4">
              Nieuwsbrief
            </p>
            <h2
              id="newsletter-heading"
              className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white mb-5 leading-[1.05]"
            >
              Nieuwe collecties, <span className="italic text-accent-light">als eerste</span>.
            </h2>
            <p className="text-white/80 text-base lg:text-lg leading-[1.6] mb-10 max-w-md mx-auto">
              Nieuwe stukken, stijladvies en aanbiedingen uit de showroom.
            </p>
            <DarkNewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
