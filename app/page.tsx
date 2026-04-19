import Link from "next/link";
import Hero from "@/components/Hero";
import ProductCard from "@/components/ProductCard";
import FeaturedShowcase from "@/components/FeaturedShowcase";
import CategoriesShowcase from "@/components/CategoriesShowcase";
import ShowroomSection from "@/components/ShowroomSection";
import IntroSection from "@/components/IntroSection";
import EditorialQuote from "@/components/EditorialQuote";
import SectionHeader from "@/components/SectionHeader";
import NewsletterForm from "@/components/NewsletterForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getFeaturedProducts() {
  try {
    return await prisma.product.findMany({ where: { featured: true }, take: 10 });
  } catch {
    return [];
  }
}

async function getNewestProducts() {
  try {
    return await prisma.product.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [featuredProducts, newestProducts] = await Promise.all([
    getFeaturedProducts(),
    getNewestProducts(),
  ]);

  return (
    <>
      {/* ─── 01 — HERO ─── */}
      <Hero />

      {/* ─── 02 — INTRODUCTIE ─── */}
      <IntroSection />

      {/* ─── 03 — UITGELICHTE COLLECTIE ─── */}
      <FeaturedShowcase products={featuredProducts} />

      {/* ─── 04 — EDITORIAL QUOTE ─── */}
      <EditorialQuote />

      {/* ─── 05 — CATEGORIEËN ─── */}
      <CategoriesShowcase />

      {/* ─── 06 — NIEUWSTE PRODUCTEN ─── */}
      <section className="py-28 lg:py-40">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="mb-16 lg:mb-20">
            <SectionHeader
              number="06"
              label="Net Binnen"
              title="Nieuw in de"
              titleItalic="collectie"
              linkHref="/products"
              linkLabel="Alle producten"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-14 sm:gap-x-6 sm:gap-y-20">
            {newestProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── 07 — ATELIER / SHOWROOM ─── */}
      <ShowroomSection />

      {/* ─── 08 — SERVICE ─── */}
      <section className="bg-white border-t border-line">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-line">
            {[
              { num: "01", title: "Gratis verzending", sub: "Vanaf €100 in NL" },
              { num: "02", title: "Tweejaarsgarantie", sub: "Op elk product" },
              { num: "03", title: "Retourneren", sub: "30 dagen bedenktijd" },
              { num: "04", title: "Persoonlijk", sub: "Advies op maat" },
            ].map((item) => (
              <div key={item.num} className="py-12 lg:py-14 lg:px-10 first:lg:pl-0 last:lg:pr-0">
                <p className="eyebrow mb-3">{item.num}</p>
                <p className="font-serif text-xl sm:text-2xl text-ink mb-1 leading-tight">{item.title}</p>
                <p className="text-sm text-stone">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 09 — NIEUWSBRIEF ─── */}
      <section className="py-28 lg:py-40 bg-paper border-t border-line">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="max-w-2xl mx-auto text-center">
            <p className="eyebrow mb-6">Journal</p>
            <h2 className="display-md text-ink mb-6 leading-[1.1]">
              Inspiratie, nieuwe <span className="italic">collecties</span>,
              <br className="hidden sm:block" />
              rechtstreeks in je inbox.
            </h2>
            <p className="body-lg mb-10 text-stone max-w-md mx-auto">
              Twee keer per maand delen we nieuwe stukken, stijladvies en exclusieve aanbiedingen.
            </p>
            <NewsletterForm />
            <p className="text-xs text-stone mt-8">
              Je kunt je op elk moment uitschrijven. Lees ons{" "}
              <Link href="/privacybeleid" className="underline hover:text-ink">privacybeleid</Link>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
