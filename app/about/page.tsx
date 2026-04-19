import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";

export const metadata: Metadata = {
  title: "Over Ons — Mokka Home Interior",
  description: "Leer meer over de missie van Mokka Home Interior: ambachtelijk design, eerlijke materialen en tijdloze kwaliteit.",
};

const values = [
  {
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    title: "Vakmanschap",
    text: "Elk stuk is geselecteerd op superieure materialen, constructie en oog voor detail. We werken samen met ambachtslieden die onze toewijding aan kwaliteit delen.",
  },
  {
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    title: "Doordacht Design",
    text: "Minimalistisch maar warm — onze collecties overbruggen de kloof tussen vorm en functie. Elk product is ontworpen om je dagelijks leven te verrijken.",
  },
  {
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064",
    title: "Duurzame Keuze",
    text: "Wij geven prioriteit aan duurzame materialen en ethische productie. Investeren in kwaliteit betekent minder verspilling en stukken die generaties meegaan.",
  },
];

export default function AboutPage() {
  return (
    <div className="pt-32 pb-20">
      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-20">
        <AnimatedSection className="text-center max-w-3xl mx-auto">
          <p className="eyebrow">Wie Zijn Wij</p>
          <h1 className="display-md text-ink mb-6">Over Mokka Home Interior</h1>
          <div className="w-12 h-[1px] bg-bronze mx-auto mb-8" />
          <p className="text-stone text-lg leading-relaxed">
            Wij geloven dat mooi design onderdeel moet zijn van het dagelijks leven. Mokka Home Interior selecteert meubels, verlichting en decoratie die ruimtes omtovert in een thuis.
          </p>
        </AnimatedSection>
      </div>

      {/* Waarden */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-24">
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {values.map((value) => (
            <StaggerItem key={value.title} className="text-center">
              <div className="w-16 h-16 bg-white border border-line rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-7 h-7 text-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={value.icon} />
                </svg>
              </div>
              <h3 className="font-serif text-xl text-ink mb-3">{value.title}</h3>
              <p className="text-stone leading-relaxed text-sm">{value.text}</p>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>

      {/* Verhaal */}
      <div className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <AnimatedSection className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <p className="eyebrow">Het Begin</p>
              <h2 className="text-2xl md:text-3xl font-serif text-ink">Ons Verhaal</h2>
              <div className="w-8 h-[1px] bg-bronze mx-auto mt-4" />
            </div>
            <div className="text-stone leading-[1.9] space-y-5 text-center">
              <p>
                Mokka Home Interior is opgericht met een simpel geloof: je huis moet weerspiegelen wie je bent. In een wereld van massaproductie zagen wij de behoefte aan zorgvuldig geselecteerde, mooi ontworpen woonproducten die moderne esthetiek combineren met tijdloze kwaliteit.
              </p>
              <p>
                Ons team reist door heel Europa om opkomende ontwerpers en gevestigde ambachtslieden te ontdekken die onze passie voor uitzonderlijk vakmanschap delen. Van Scandinavisch geïnspireerde meubels tot handgedraaid keramiek — elk item in onze collectie vertelt een verhaal.
              </p>
              <p>
                Vanuit Nederland bedienen we designbewuste klanten die het verschil waarderen dat kwaliteit maakt. Of je nu je eerste appartement inricht of je gezinswoning vernieuwt, Mokka Home Interior helpt je ruimtes te creëren waar je van houdt.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-20">
        <AnimatedSection className="text-center">
          <h2 className="text-2xl md:text-3xl font-serif text-ink mb-4">Klaar om je interieur te transformeren?</h2>
          <p className="text-stone mb-8">Ontdek onze collectie en vind de perfecte stukken voor jouw thuis.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/products" className="btn-primary text-center">Bekijk Collectie</Link>
            <Link href="/contact" className="btn-ghost text-center">Neem Contact Op</Link>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
