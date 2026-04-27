import Hero from "@/components/Hero";
import CollectionPreview from "@/components/CollectionPreview";
import CategoriesGrid from "@/components/CategoriesGrid";
import FeaturedStory from "@/components/FeaturedStory";
import ShowroomSection from "@/components/ShowroomSection";
import SocialProof from "@/components/SocialProof";
import DarkNewsletterForm from "@/components/DarkNewsletterForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getFeaturedProducts() {
  try {
    return await prisma.product.findMany({ where: { featured: true }, take: 8 });
  } catch {
    return [];
  }
}

async function getSpotlightProduct() {
  try {
    // Selecteer een uitgelicht product voor de editorial spotlight
    return await prisma.product.findFirst({
      where: { featured: true, category: "banken" },
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
      {/* 01 — HERO              bg-paper (licht) */}
      <Hero />

      {/* 02 — CATEGORIEËN       bg-white (ritme breuk) */}
      <CategoriesGrid />

      {/* 03 — FEATURED STORY    bg-ink (donker, drama) */}
      <FeaturedStory product={spotlightProduct} />

      {/* 04 — NIEUWE COLLECTIE  bg-paper */}
      <CollectionPreview products={featuredProducts} />

      {/* 05 — SOCIAL PROOF      bg-white */}
      <SocialProof />

      {/* 06 — ATELIER           bg-paper */}
      <ShowroomSection />

      {/* 07 — NIEUWSBRIEF       bg-ink (afsluiting, drama) */}
      <section className="py-24 lg:py-32 bg-ink text-white">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="max-w-xl mx-auto text-center">
            <p className="text-white/50 text-[11px] uppercase tracking-[0.3em] mb-5">Nieuwsbrief</p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white mb-5 leading-[1.05]">
              Nieuwe collecties, <span className="italic text-bronze">als eerste</span>.
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
