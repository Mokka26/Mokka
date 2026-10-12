import Link from "next/link";
import { ArrowUpRight, MapPin, Phone, Clock } from "lucide-react";
import {
  businessInfo,
  getMapsUrl,
  getOpeningHoursCompact,
  getPhoneLink,
} from "@/lib/business-info";
import ShowroomVideo from "@/components/ShowroomVideo";

// Server component; alleen de video (pauzeknop) is client-side. Alle
// adres-, openingstijd- en telefoongegevens komen uit lib/business-info.
export default function ShowroomSection() {
  const phoneLink = getPhoneLink();
  const hours = getOpeningHoursCompact();
  const { city, street, postalCode } = businessInfo.address;

  return (
    <section className="py-20 lg:py-32 bg-paper" aria-labelledby="showroom-heading">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-7">
            <ShowroomVideo
              src="/mokka.mp4"
              poster="/mokka-poster.jpg"
              label={`Sfeerbeelden van de showroom van ${businessInfo.name} in ${city}`}
            />
          </div>

          <div className="lg:col-span-5">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-accent-dark mb-4">
              Showroom
            </p>
            <h2 id="showroom-heading" className="display-md text-ink mb-6">
              Kom langs in onze showroom in {city}
            </h2>
            <p className="body-lg mb-8 max-w-md">
              Online kijken is handig, maar een bank moet je voelen. In onze
              showroom zie je de collectie in het echt, zit je proef en krijg
              je advies van ons team, ook over maten en stoffen.
            </p>

            <dl className="space-y-4 mb-10 border-t border-line pt-8">
              <div className="flex items-start gap-4">
                <dt className="flex items-center gap-2 text-sm text-stone w-24 shrink-0 pt-0.5">
                  <MapPin className="w-4 h-4" strokeWidth={1.5} aria-hidden />
                  Adres
                </dt>
                <dd className="text-base text-ink">
                  <a
                    href={getMapsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent-dark transition-colors"
                  >
                    {street}
                    <br />
                    {postalCode} {city}
                  </a>
                </dd>
              </div>
              <div className="flex items-start gap-4">
                <dt className="flex items-center gap-2 text-sm text-stone w-24 shrink-0 pt-0.5">
                  <Clock className="w-4 h-4" strokeWidth={1.5} aria-hidden />
                  Open
                </dt>
                <dd className="text-base text-ink">
                  {hours.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
              {phoneLink && businessInfo.contact.phoneFormatted && (
                <div className="flex items-start gap-4">
                  <dt className="flex items-center gap-2 text-sm text-stone w-24 shrink-0 pt-0.5">
                    <Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden />
                    Bel
                  </dt>
                  <dd className="text-base text-ink">
                    <a href={phoneLink} className="hover:text-accent-dark transition-colors">
                      {businessInfo.contact.phoneFormatted}
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
              <Link href="/contact" className="btn-primary text-sm">
                Plan een bezoek
              </Link>
              <a
                href={getMapsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-link text-sm"
              >
                Routebeschrijving
                <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
