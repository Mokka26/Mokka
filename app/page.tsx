import type { Metadata } from "next";
import CinematicHero from "@/components/CinematicHeroLazy";
import PromoBanners from "@/components/PromoBanners";
import CollectionPreview from "@/components/CollectionPreview";
import CategoriesGrid from "@/components/CategoriesGrid";
import FeaturedStory from "@/components/FeaturedStory";
import ShowroomSection from "@/components/ShowroomSection";
import TrustBar from "@/components/TrustBar";
import DarkNewsletterForm from "@/components/DarkNewsletterForm";
import { prisma } from "@/lib/prisma";
import { businessInfo } from "@/lib/business-info";

// ISR: featured + spotlight veranderen alleen bij admin-mutaties.
// 1h revalidate balanceert verse content tegen CDN-cache hits.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `${businessInfo.name} — Premium designmeubels`,
  description: `${businessInfo.tagline} Ontdek banken, eettafels, verlichting en meer in onze showroom in ${businessInfo.address.city} of online.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${businessInfo.name} — Premium designmeubels`,
    description: businessInfo.tagline,
    type: "website",
    url: "/",
    locale: "nl_NL",
  },
};

// select-clauses houden response klein: alleen wat CollectionPreview +
// FeaturedStory daadwerkelijk tonen. Slug/description meegegeven want
// FeaturedStory linkt + toont productbeschrijving.

async function getFeaturedProducts() {
  try {
    return await prisma.product.findMany({
      where: { featured: true, hidden: false, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        price: true,
        category: true,
        images: true,
        featured: true,
        stock: true,
        createdAt: true,
        colorGroup: true,
        colorName: true,
        colorHex: true,
        specs: true,
      },
      take: 8,
    });
  } catch {
    return [];
  }
}

async function getSpotlightProduct() {
  try {
    return await prisma.product.findFirst({
      where: { featured: true, category: "banken", hidden: false, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        category: true,
        images: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [featuredProducts, spotlightProduct] = await Promise.all([
    getFeaturedProducts(),
    getSpotlightProduct(),
  ]);

  return (
    <>
      {/* 01 — CINEMATIC HERO    Three.js + GSAP scroll-driven */}
      <CinematicHero />

      {/* 02 — PROMO BANNERS     bg-paper (3 stacked promo cards) */}
      <PromoBanners />

      {/* 03 — CATEGORIEËN       bg-white (ritme breuk) */}
      <CategoriesGrid />

      {/* 04 — FEATURED STORY    bg-ink (donker, drama) */}
      <FeaturedStory product={spotlightProduct} />

      {/* 05 — NIEUWE COLLECTIE  bg-paper */}
      <CollectionPreview products={featuredProducts} />

      {/* 07 — ATELIER           bg-paper */}
      <ShowroomSection />

      {/* 08 — TRUST BAR         bg-bone (USPs voor newsletter) */}
      <TrustBar />

      {/* 07 — NIEUWSBRIEF       bg-ink (afsluiting, drama) */}
      <section className="py-24 lg:py-32 bg-ink text-white">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="max-w-xl mx-auto text-center">
            <p className="text-white/50 text-[11px] uppercase tracking-[0.3em] mb-5">Nieuwsbrief</p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white mb-5 leading-[1.05]">
              Nieuwe collecties, <span className="italic text-accent">als eerste</span>.
            </h2>
            <p className="text-white/60 text-base mb-10 max-w-md mx-auto">
              Twee keer per maand — nieuwe stukken, stijladvies en exclusieve aanbiedingen.
            </p>
            <DarkNewsletterForm />
            <p className="text-xs text-white/40 mt-6">
              Geen spam. Uitschrijven kan altijd.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
