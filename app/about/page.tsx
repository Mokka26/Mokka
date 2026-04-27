import type { Metadata } from "next";
import Link from "next/link";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";
import SectionHeader from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Over Ons — Mokka Home Interior",
  description: "Leer meer over de missie van Mokka Home Interior: ambachtelijk design, eerlijke materialen en tijdloze kwaliteit.",
};

const values = [
  {
    number: "01",
    title: "Vakmanschap",
    text: "Elk stuk is geselecteerd op superieure materialen, constructie en oog voor detail. We werken samen met ambachtslieden die onze toewijding aan kwaliteit delen.",
  },
  {
    number: "02",
    title: "Doordacht Design",
    text: "Minimalistisch maar warm — onze collecties overbruggen de kloof tussen vorm en functie. Elk product is ontworpen om je dagelijks leven te verrijken.",
  },
  {
    number: "03",
    title: "Duurzame Keuze",
    text: "Wij geven prioriteit aan duurzame materialen en ethische productie. Investeren in kwaliteit betekent minder verspilling en stukken die generaties meegaan.",
  },
];

export default function AboutPage() {
  return (
    <div className="pt-32 lg:pt-40 pb-28 lg:pb-40">
      {/* Hero intro */}
      <section className="mb-32 lg:mb-48">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <AnimatedSection>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end">
              <div className="lg:col-span-8">
                <div className="flex items-center gap-4 mb-8">
                  <span className="font-serif italic text-stone text-sm">— 01</span>
                  <span className="eyebrow">Wie Zijn Wij</span>
                </div>
                <h1 className="display-xl text-ink">
                  Over Mokka <span className="italic text-stone/80">Home Interior</span>
                </h1>
              </div>
              <div className="lg:col-span-4">
                <p className="body-lg text-slate">
                  Wij geloven dat mooi design onderdeel moet zijn van het dagelijks leven. Mokka Home Interior selecteert meubels, verlichting en decoratie die ruimtes omtovert in een thuis.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Waarden */}
      <section className="mb-32 lg:mb-48">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="mb-16 lg:mb-24">
            <SectionHeader
              number="02"
              label="Wat ons drijft"
              title="Onze"
              titleItalic="waarden"
            />
          </div>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            {values.map((value) => (
              <StaggerItem key={value.title}>
                <div className="border-t border-line pt-8">
                  <span className="font-serif italic text-stone text-sm block mb-6">— {value.number}</span>
                  <h3 className="font-serif text-3xl lg:text-4xl text-ink mb-6 leading-tight">{value.title}</h3>
                  <p className="body-lg text-slate">{value.text}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Verhaal */}
      <section className="bg-white py-32 lg:py-48 mb-32 lg:mb-48">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="mb-16 lg:mb-24">
            <SectionHeader
              number="03"
              label="Het Begin"
              title="Ons"
              titleItalic="verhaal"
            />
          </div>
          <AnimatedSection>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-2 hidden lg:block">
                <span className="eyebrow">Hoofdstuk 01</span>
              </div>
              <div className="lg:col-span-10 space-y-8">
                <p className="font-serif text-2xl lg:text-3xl text-ink leading-snug">
                  Mokka Home Interior is opgericht met een simpel geloof: je huis moet weerspiegelen wie je bent. In een wereld van massaproductie zagen wij de behoefte aan zorgvuldig geselecteerde, mooi ontworpen woonproducten die moderne esthetiek combineren met tijdloze kwaliteit.
                </p>
                <p className="body-lg text-slate max-w-3xl">
                  Ons team reist door heel Europa om opkomende ontwerpers en gevestigde ambachtslieden te ontdekken die onze passie voor uitzonderlijk vakmanschap delen. Van Scandinavisch geïnspireerde meubels tot handgedraaid keramiek — elk item in onze collectie vertelt een verhaal.
                </p>
                <p className="body-lg text-slate max-w-3xl">
                  Vanuit Nederland bedienen we designbewuste klanten die het verschil waarderen dat kwaliteit maakt. Of je nu je eerste appartement inricht of je gezinswoning vernieuwt, Mokka Home Interior helpt je ruimtes te creëren waar je van houdt.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <AnimatedSection className="text-center max-w-3xl mx-auto">
            <p className="eyebrow mb-8">Begin hier</p>
            <h2 className="display-lg text-ink mb-8">
              Klaar om je interieur te <span className="italic text-stone/80">transformeren?</span>
            </h2>
            <p className="body-lg text-slate mb-12">
              Ontdek onze collectie en vind de perfecte stukken voor jouw thuis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/products" className="btn-primary text-center">Bekijk Collectie</Link>
              <Link href="/contact" className="btn-ghost text-center">Neem Contact Op</Link>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
