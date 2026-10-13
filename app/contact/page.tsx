import { Suspense } from "react";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { buildBreadcrumbJsonLd, jsonLdHtml, type BreadcrumbItem } from "@/lib/jsonLd";
import ContactForm from "./ContactForm";
import {
  businessInfo,
  getMapsUrl,
  getOpeningHoursCompact,
  getPhoneLink,
  getEmailLink,
} from "@/lib/business-info";

// Metadata (title/description/canonical) staat in app/contact/layout.tsx.

const breadcrumbs: BreadcrumbItem[] = [
  { name: "Home", url: "/" },
  { name: "Contact", url: "/contact" },
];

export default function ContactPage() {
  const phoneLink = getPhoneLink();
  const emailLink = getEmailLink();
  const hours = getOpeningHoursCompact();

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-28 lg:pt-32 pb-28 lg:pb-40">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(buildBreadcrumbJsonLd(breadcrumbs)) }}
      />

      {/* Kop */}
      <AnimatedSection className="mb-12 lg:mb-24">
        <Breadcrumbs items={breadcrumbs} className="mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-end">
          <div className="lg:col-span-8">
            <p className="eyebrow mb-6">Neem contact op</p>
            <h1 className="display-xl text-ink">Contact</h1>
          </div>
          <div className="lg:col-span-4">
            <p className="body-lg text-slate">
              Een vraag over een product, hulp bij een bestelling of advies over je interieur? Bel, mail of kom langs in de showroom. We denken graag met je mee.
            </p>
          </div>
        </div>
      </AnimatedSection>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        {/* Gegevens — bron: lib/business-info.ts */}
        <AnimatedSection direction="left" className="lg:col-span-5">
          <div className="border-t border-line pt-10">
            <p className="eyebrow">Bereikbaar</p>
            <h2 className="display-md text-ink mt-4 mb-10">
              We horen graag <span className="italic text-stone">van je</span>
            </h2>

            <ul className="space-y-8 list-none m-0 p-0">
              {phoneLink && businessInfo.contact.phoneFormatted && (
                <li className="flex items-start gap-5">
                  <Phone className="w-5 h-5 text-accent-dark flex-shrink-0 mt-1" strokeWidth={1.5} aria-hidden="true" />
                  <div>
                    <p className="eyebrow mb-1">Telefoon</p>
                    <a
                      href={phoneLink}
                      className="inline-flex items-center min-h-11 font-serif text-xl text-ink hover:text-accent-dark transition-colors"
                      aria-label={`Bel ons: ${businessInfo.contact.phoneFormatted}`}
                    >
                      {businessInfo.contact.phoneFormatted}
                    </a>
                    <p className="text-base text-slate">Tijdens openingstijden van de showroom.</p>
                  </div>
                </li>
              )}

              {emailLink && (
                <li className="flex items-start gap-5">
                  <Mail className="w-5 h-5 text-accent-dark flex-shrink-0 mt-1" strokeWidth={1.5} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="eyebrow mb-1">E-mail</p>
                    <a
                      href={emailLink}
                      className="inline-flex items-center min-h-11 font-serif text-xl text-ink hover:text-accent-dark transition-colors break-all"
                    >
                      {businessInfo.contact.email}
                    </a>
                    <p className="text-base text-slate">We reageren zo snel mogelijk, meestal binnen één werkdag.</p>
                  </div>
                </li>
              )}

              <li className="flex items-start gap-5">
                <MapPin className="w-5 h-5 text-accent-dark flex-shrink-0 mt-1" strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <p className="eyebrow mb-1">Showroom</p>
                  <a
                    href={getMapsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-serif text-xl text-ink leading-snug hover:text-accent-dark transition-colors py-1"
                  >
                    {businessInfo.address.street}<br />
                    {businessInfo.address.postalCode} {businessInfo.address.city}
                    <span className="sr-only"> (opent in Google Maps, nieuw venster)</span>
                  </a>
                  <p className="text-base text-slate">Kom langs om de collectie te bekijken.</p>
                </div>
              </li>

              <li className="flex items-start gap-5">
                <Clock className="w-5 h-5 text-accent-dark flex-shrink-0 mt-1" strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <p className="eyebrow mb-1">Openingstijden</p>
                  <dl className="font-serif text-xl text-ink leading-snug">
                    {hours.map((line) => {
                      const [days, ...rest] = line.split(" ");
                      return (
                        <div key={line} className="flex gap-3">
                          <dt className="min-w-[4.5rem]">{days}</dt>
                          <dd>{rest.join(" ")}</dd>
                        </div>
                      );
                    })}
                    {!businessInfo.openingHours.sunday && (
                      <div className="flex gap-3">
                        <dt className="min-w-[4.5rem]">Zo</dt>
                        <dd>Gesloten</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </li>
            </ul>
          </div>
        </AnimatedSection>

        {/* Formulier — useSearchParams vereist een Suspense-grens */}
        <AnimatedSection direction="right" className="lg:col-span-7 min-w-0">
          <Suspense fallback={<div className="bg-white border border-line p-5 sm:p-8 lg:p-12 min-h-[32rem]" aria-busy="true" />}>
            <ContactForm />
          </Suspense>
        </AnimatedSection>
      </div>
    </div>
  );
}
