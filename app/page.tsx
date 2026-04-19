import Link from "next/link";
import Image from "next/image";
import Hero from "@/components/Hero";
import ProductCard from "@/components/ProductCard";
import HorizontalScroll from "@/components/HorizontalScroll";
import FeaturedShowcase from "@/components/FeaturedShowcase";
import AnimatedSection from "@/components/AnimatedSection";
import NewsletterForm from "@/components/NewsletterForm";
import ShowroomSection from "@/components/ShowroomSection";
import CategoriesShowcase from "@/components/CategoriesShowcase";
import Marquee from "@/components/Marquee";
import IntroSection from "@/components/IntroSection";
import { prisma } from "@/lib/prisma";

async function getFeaturedProducts() {
  return prisma.product.findMany({ where: { featured: true }, take: 10 });
}

async function getNewestProducts() {
  return prisma.product.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
}

const categories = [
  { name: "Banken", slug: "banken", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900" },
  { name: "Tafels", slug: "tafels", image: "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=900" },
  { name: "Stoelen", slug: "stoelen", image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=900" },
  { name: "Slaapkamers", slug: "slaapkamers", image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900" },
  { name: "Kasten", slug: "kasten", image: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=900" },
];

export default async function HomePage() {
  const [featuredProducts, newestProducts] = await Promise.all([
    getFeaturedProducts(),
    getNewestProducts(),
  ]);

  return (
    <>
      <Hero />

      {/* ─── Intro — Kinetic typography ─── */}
      <IntroSection />

      {/* ─── Uitgelicht — Editorial showcase ─── */}
      <FeaturedShowcase products={featuredProducts} />

      {/* ─── Marquee — Kinetic typography ─── */}
      <section className="py-12 bg-paper border-y border-line overflow-hidden">
        <Marquee items={["Meubels", "Design", "Vakmanschap", "Interieur", "Ambacht"]} />
      </section>

      {/* ─── Categorieën — Horizontale showcase ─── */}
      <CategoriesShowcase />

      {/* ─── Ambacht statement — Full bleed ─── */}
      <section className="relative h-[70vh] lg:h-[80vh] overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1800"
          alt="Ambacht"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-ink/50" />
        <div className="relative z-10 h-full flex items-center justify-center px-6">
          <AnimatedSection className="text-center max-w-3xl">
            <p className="eyebrow text-white/60 mb-6">Ambacht</p>
            <h2 className="display-lg text-white mb-8">
              Elk stuk is gemaakt
              <br />
              met <span className="italic">intentie</span>
            </h2>
            <p className="body-lg text-white/70 mb-10 max-w-xl mx-auto">
              We werken uitsluitend met ambachtslieden die hun vak verstaan. Geen massaproductie — alleen meubels die gemaakt zijn om een leven lang mee te gaan.
            </p>
            <Link href="/about" className="inline-block text-white text-[11px] uppercase tracking-[0.3em] border-b border-white/40 hover:border-white pb-2 transition-colors">
              Lees meer
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── Showroom — Echte winkel ─── */}
      <ShowroomSection />

      {/* ─── Nieuwste — Clean grid ─── */}
      <section className="py-32 lg:py-48">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
          <AnimatedSection className="mb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              <div className="lg:col-span-8">
                <p className="eyebrow mb-4">04 — Recent</p>
                <h2 className="display-lg text-ink">
                  Net <span className="italic">binnen</span>
                </h2>
              </div>
              <div className="lg:col-span-4 lg:text-right">
                <Link href="/products" className="btn-link">
                  Alle producten
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16">
            {newestProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Service belofte ─── */}
      <section className="border-t border-line">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-line">
            {[
              { num: "01", title: "Gratis verzending", sub: "Vanaf €100 in NL" },
              { num: "02", title: "2 jaar garantie", sub: "Op elk product" },
              { num: "03", title: "30 dagen retour", sub: "Gratis retourneren" },
              { num: "04", title: "Persoonlijk advies", sub: "Atelier in Amsterdam" },
            ].map((item) => (
              <div key={item.num} className="py-10 lg:py-12 lg:px-10 first:lg:pl-0 last:lg:pr-0">
                <p className="eyebrow mb-3">{item.num}</p>
                <p className="font-serif text-xl text-ink mb-1">{item.title}</p>
                <p className="text-sm text-stone">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Nieuwsbrief ─── */}
      <section className="bg-white py-32 lg:py-40">
        <AnimatedSection className="max-w-xl mx-auto px-6 text-center">
          <p className="eyebrow mb-6">Newsletter</p>
          <h2 className="display-md text-ink mb-6">
            Ontvang nieuwe <span className="italic">collecties</span> in je inbox
          </h2>
          <p className="body-lg mb-10 text-stone">
            Inspiratie, nieuwe stukken en exclusieve aanbiedingen. Maximaal twee keer per maand.
          </p>
          <NewsletterForm />
          <p className="text-xs text-stone mt-6">Je kunt je op elk moment uitschrijven.</p>
        </AnimatedSection>
      </section>
    </>
  );
}
