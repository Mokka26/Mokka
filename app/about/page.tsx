import type { Metadata } from "next";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/AnimatedSection";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { businessInfo, getFullAddress, getOpeningHoursCompact, getPhoneLink } from "@/lib/business-info";
import { shippingInfo } from "@/lib/shipping-info";

export const metadata: Metadata = {
  title: `Over ons: showroom en werkwijze in ${businessInfo.address.city}`,
  description: `Mokka Home is een meubelwinkel met showroom in ${businessInfo.address.city}: banken, tafels, stoelen, kasten en verlichting. Kom proefzitten, bezorging en montage op afspraak.`,
  alternates: { canonical: "/about" },
};

// Feitelijke beschrijving — geen claims die we (nog) niet kunnen onderbouwen
// (CLAUDE.md §4). Positionering volgt zodra docs/brand.md is bevestigd.
const pillars = [
  {
    number: "01",
    title: "Zien en voelen",
    text: `Een bank koop je niet van een foto. In onze showroom in ${businessInfo.address.city} zit je op de modellen, voel je de stoffen en zie je de kleuren bij daglicht. Kom langs tijdens openingstijden, een afspraak is niet nodig.`,
  },
  {
    number: "02",
    title: "Eerlijk advies",
    text: "Past die hoekbank wel in je kamer? Welke tafelmaat werkt voor zes personen? We rekenen het met je uit en zeggen het ook als iets niet past. Je hoort levertijd en kosten vóór je bestelt.",
  },
  {
    number: "03",
    title: "Bezorging en montage",
    text: `Grote meubels bezorgen we op afspraak en zetten we op verzoek voor je in elkaar. ${shippingInfo.freeShippingCopyShort} binnen Nederland en België, en je hebt ${shippingInfo.returnWindowDays} dagen bedenktijd.`,
  },
];

export default function AboutPage() {
  const phoneLink = getPhoneLink();
  const hours = getOpeningHoursCompact();

  return (
    <div className="pt-32 lg:pt-40 pb-28 lg:pb-40">
      {/* Intro */}
      <section className="mb-24 lg:mb-40">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <AnimatedSection>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end">
              <div className="lg:col-span-8">
                <p className="eyebrow mb-6">Over ons</p>
                <h1 className="display-xl text-ink">
                  Over <span className="italic text-stone">{businessInfo.name}</span>
                </h1>
              </div>
              <div className="lg:col-span-4">
                <p className="body-lg text-slate">
                  {businessInfo.name} is een meubelwinkel in {businessInfo.address.city} met een webshop. We verkopen banken, tafels, stoelen, bedden, kasten en verlichting van fabrikanten uit Europa, en helpen je kiezen wat bij je huis past.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Hoe we werken */}
      <section className="mb-24 lg:mb-40">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="mb-16 lg:mb-24">
            <SectionHeader
              number="02"
              label="Hoe we werken"
              title="Wat je van ons"
              titleItalic="mag verwachten"
            />
          </div>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            {pillars.map((p) => (
              <StaggerItem key={p.title}>
                <div className="border-t border-line pt-8">
                  <span className="font-serif italic text-stone text-base block mb-6">— {p.number}</span>
                  <h3 className="font-serif text-3xl lg:text-4xl text-ink mb-6 leading-tight">{p.title}</h3>
                  <p className="body-lg text-slate">{p.text}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Het assortiment */}
      <section className="bg-white py-24 lg:py-40 mb-24 lg:mb-40">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="mb-16 lg:mb-24">
            <SectionHeader
              number="03"
              label="Het assortiment"
              title="Wat je bij ons"
              titleItalic="vindt"
            />
          </div>
          <AnimatedSection>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-10 lg:col-start-2 space-y-8">
                <p className="font-serif text-2xl lg:text-3xl text-ink leading-snug">
                  We kiezen meubels waar je jaren plezier van hebt: banken die prettig zitten, tafels met een stevig blad en bedden die goed liggen. Geen eigen fabriek, wel een selectie die we zelf kennen en in de showroom laten zien.
                </p>
                <p className="body-lg text-slate max-w-3xl">
                  Ons assortiment komt van fabrikanten uit Europa. Veel modellen zijn er in meerdere maten, stoffen en kleuren; in de showroom zie je stalen en voorbeelden. Op de productpagina vind je afmetingen met praktische context, zodat je thuis kunt nameten of het past.
                </p>
                <p className="body-lg text-slate max-w-3xl">
                  Bestellen kan in de webshop of in de winkel. Wat op voorraad is, leveren we binnen {shippingInfo.deliveryTime.inStock}; bestelwerk duurt {shippingInfo.deliveryTime.backorder}. Die levertijd staat altijd bij het product, voordat je afrekent.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Showroom + CTA */}
      <section>
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <AnimatedSection className="text-center max-w-3xl mx-auto">
            <p className="eyebrow mb-6">Showroom</p>
            <h2 className="display-lg text-ink mb-6">
              Kom <span className="italic text-stone">proefzitten</span>
            </h2>
            <p className="body-lg text-slate mb-4">
              {getFullAddress()}
            </p>
            <p className="text-base text-slate mb-10">
              {hours.join(" · ")}
              {!businessInfo.openingHours.sunday && " · Zo gesloten"}
              {phoneLink && businessInfo.contact.phoneFormatted && (
                <>
                  {" · "}
                  <a href={phoneLink} className="text-ink underline underline-offset-2" aria-label={`Bel ons: ${businessInfo.contact.phoneFormatted}`}>
                    {businessInfo.contact.phoneFormatted}
                  </a>
                </>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button href="/products">Bekijk de collectie</Button>
              <Button href="/contact" variant="secondary">Neem contact op</Button>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
