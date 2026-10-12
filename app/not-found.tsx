import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CATEGORIES, categoryUrl } from "@/lib/categories";
import { businessInfo, getPhoneLink } from "@/lib/business-info";

const quickLinks = CATEGORIES.filter((c) => c.isUmbrella).concat(
  CATEGORIES.filter((c) => c.slug === "bedden" || c.slug === "slaapkamers"),
);

export default function NotFound() {
  const phoneLink = getPhoneLink();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-24">
      <div className="max-w-[1600px] w-full mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <p className="font-serif text-[clamp(6rem,18vw,14rem)] leading-none text-accent/30 mb-2 select-none" aria-hidden="true">
            404
          </p>
          <p className="eyebrow mb-6">Pagina niet gevonden</p>
          <h1 className="display-lg text-ink mb-6">
            Deze pagina <span className="italic text-stone">bestaat niet</span>
          </h1>
          <p className="body-lg text-slate mb-10 max-w-md mx-auto">
            Misschien is het product uit het assortiment, of klopt de link niet meer. Zoek hieronder, of kies een categorie.
          </p>

          {/* Werkt zonder JavaScript: gewone GET naar de productpagina */}
          <form action="/products" method="get" role="search" className="max-w-md mx-auto mb-10">
            <label htmlFor="notfound-search" className="sr-only">Zoek in de webshop</label>
            <div className="flex items-end gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-stone" strokeWidth={1.5} aria-hidden="true" />
                <input
                  id="notfound-search"
                  type="search"
                  name="q"
                  placeholder="Bijvoorbeeld: hoekbank"
                  className="input-field pl-8"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">Zoeken</Button>
            </div>
          </form>

          <nav aria-label="Categorieën" className="mb-12">
            <ul className="flex flex-wrap justify-center gap-2 list-none m-0 p-0">
              {quickLinks.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={categoryUrl(c.slug)}
                    className="inline-flex items-center min-h-11 px-4 rounded-full border border-line-strong text-base text-ink hover:border-ink hover:bg-bone transition-colors"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Button href="/">Naar de homepage</Button>
            <Button href="/products" variant="secondary">Alle producten</Button>
          </div>

          {phoneLink && businessInfo.contact.phoneFormatted && (
            <p className="text-base text-slate">
              Hulp nodig? Bel ons op{" "}
              <a href={phoneLink} className="text-ink underline underline-offset-2" aria-label={`Bel ons: ${businessInfo.contact.phoneFormatted}`}>
                {businessInfo.contact.phoneFormatted}
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
