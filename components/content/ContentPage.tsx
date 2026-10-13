import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import ProductCard, { type ProductCardProduct } from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { buildBreadcrumbJsonLd, buildFaqJsonLd, jsonLdHtml, type BreadcrumbItem } from "@/lib/jsonLd";

/**
 * Gedeelde layout voor informatie- en adviespagina's (bezorging, betalen,
 * showroom, gidsen). Server component: geen hooks, geen event handlers.
 *
 * Verzorgt in één keer:
 *  - BreadcrumbList-schema + zichtbaar kruimelpad (dezelfde items)
 *  - één H1 met eyebrow en intro (body ≥17px, line-height 1.7)
 *  - optionele FAQ als <details> + FAQPage-schema
 *  - optionele productsectie met ProductCard + CTA naar de categorie
 *  - extra JSON-LD (bv. Article) via `jsonLd`
 *
 * Geen eigen <main>: die staat in app/layout.tsx.
 */

export type FaqItem = { q: string; a: string };

export type ContentProductsSection = {
  heading: string;
  /** Korte regel onder de kop, bv. "Op voorraad, uit de collectie." */
  intro?: string;
  products: ReadonlyArray<ProductCardProduct>;
  ctaHref: string;
  ctaLabel: string;
};

interface ContentPageProps {
  /** Korte label boven de H1, bv. "Service" of "Gids". */
  eyebrow: string;
  title: string;
  intro: string;
  /** Volledige keten incl. Home; het laatste item is de huidige pagina. */
  breadcrumbs: ReadonlyArray<BreadcrumbItem>;
  children: ReactNode;
  faq?: ReadonlyArray<FaqItem>;
  faqHeading?: string;
  products?: ContentProductsSection;
  /** Extra schema's (Article e.d.); BreadcrumbList en FAQPage komen hier al uit. */
  jsonLd?: ReadonlyArray<Record<string, unknown>>;
  /** Afsluitend blok onder de inhoud, bv. een CTA-kaart. */
  footer?: ReactNode;
}

export const contentLinkClass = "text-accent-dark underline underline-offset-2 hover:text-ink";

export function ContentPage({
  eyebrow,
  title,
  intro,
  breadcrumbs,
  children,
  faq,
  faqHeading = "Veelgestelde vragen",
  products,
  jsonLd = [],
  footer,
}: ContentPageProps) {
  const faqItems = faq ?? [];
  const hasFaq = faqItems.length > 0;
  const productSection = products && products.products.length > 0 ? products : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(buildBreadcrumbJsonLd(breadcrumbs)) }}
      />
      {hasFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(buildFaqJsonLd(faqItems)) }} />
      )}
      {jsonLd.map((schema, idx) => (
        <script key={idx} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(schema) }} />
      ))}

      <div className="pt-28 lg:pt-32 pb-20 lg:pb-28">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <header className="max-w-3xl mb-12 lg:mb-16">
            <Breadcrumbs items={breadcrumbs} className="mb-6" />
            <p className="eyebrow mb-4">{eyebrow}</p>
            <h1 className="display-lg text-ink mb-6">{title}</h1>
            <p className="body-lg text-graphite">{intro}</p>
          </header>

          <div className="max-w-3xl space-y-12 lg:space-y-16">{children}</div>

          {hasFaq && (
            <section className="max-w-3xl mt-16 lg:mt-20" aria-labelledby="content-faq-heading">
              <h2 id="content-faq-heading" className="display-sm text-ink mb-5">
                {faqHeading}
              </h2>
              <div className="divide-y divide-line border-y border-line">
                {faqItems.map((item) => (
                  <details key={item.q} className="group py-1">
                    <summary className="flex items-center justify-between gap-6 min-h-12 py-3 cursor-pointer text-ink text-[17px] font-medium list-none [&::-webkit-details-marker]:hidden hover:text-accent-dark focus-visible:text-accent-dark">
                      <span>{item.q}</span>
                      <span aria-hidden="true" className="text-stone text-xl leading-none group-open:rotate-45 transition-transform">
                        +
                      </span>
                    </summary>
                    <p className="pb-5 pr-10 text-graphite body-lg">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {productSection && (
            <section className="mt-16 lg:mt-24" aria-labelledby="content-products-heading">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 lg:mb-10">
                <div>
                  <h2 id="content-products-heading" className="display-sm text-ink">
                    {productSection.heading}
                  </h2>
                  {productSection.intro && <p className="text-base text-slate mt-2">{productSection.intro}</p>}
                </div>
                <Link href={productSection.ctaHref} className="btn-link self-start sm:self-auto">
                  {productSection.ctaLabel}
                </Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12">
                {productSection.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {footer && <div className="max-w-3xl mt-16 lg:mt-20">{footer}</div>}
        </div>
      </div>
    </>
  );
}

/** Sectie met H2 + lopende tekst; `id` voor ankers in een inhoudsopgave. */
export function ContentSection({ heading, id, children }: { heading: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="display-sm text-ink mb-5">{heading}</h2>
      <div className="space-y-4 body-lg text-graphite [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-2 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-2 [&_strong]:text-ink [&_strong]:font-medium">
        {children}
      </div>
    </section>
  );
}

/** "Samengevat"-blok: korte lijst met de kernpunten van een gids. */
export function ContentSummary({ heading = "Samengevat", items }: { heading?: string; items: ReadonlyArray<string> }) {
  return (
    <section className="bg-white border border-line rounded-[10px] p-6 sm:p-8" aria-labelledby="content-summary-heading">
      <h2 id="content-summary-heading" className="font-serif text-2xl text-ink mb-4">
        {heading}
      </h2>
      <ul className="space-y-3 body-lg text-graphite">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.85em] w-3 h-px bg-accent shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Eenvoudige tabel met kop en caption; cellen zijn tekst.
 *
 * Op mobiel (< sm) geen horizontale scroll: elke rij wordt een gestapeld
 * blok — de rijkop als titel, daaronder per cel "kolomkop · waarde"
 * (kolomkop via `data-label` + ::before). De semantiek (table/th/td) blijft
 * intact voor screenreaders; de kopregel is daar `sr-only`.
 */
export function ContentTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<string>>;
}) {
  return (
    <table className="block sm:table w-full border-collapse text-base sm:text-[17px] leading-[1.6]">
      <caption className="block sm:table-caption text-left text-sm text-stone mb-3">{caption}</caption>
      <thead className="sr-only sm:not-sr-only sm:table-header-group">
        <tr className="sm:border-b sm:border-line-strong">
          {head.map((cell) => (
            <th key={cell} scope="col" className="text-left font-medium text-ink py-3 pr-6">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block sm:table-row-group border-t border-line-strong sm:border-t-0">
        {rows.map((row) => (
          <tr key={row.join("|")} className="block sm:table-row py-3 sm:py-0 border-b border-line">
            {row.map((cell, idx) =>
              idx === 0 ? (
                <th key={cell} scope="row" className="block sm:table-cell text-left font-medium text-ink pb-1 sm:py-3 sm:pr-6 tabular-nums">
                  {cell}
                </th>
              ) : (
                <td
                  key={`${idx}-${cell}`}
                  data-label={head[idx]}
                  className="flex justify-between gap-4 py-0.5 sm:table-cell sm:py-3 sm:pr-6 text-graphite tabular-nums before:content-[attr(data-label)] before:text-stone before:shrink-0 sm:before:hidden"
                >
                  <span className="text-right sm:text-left">{cell}</span>
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Afsluitend CTA-blok: titel, tekst en één primaire + optioneel secundaire knop. */
export function ContentCta({
  heading,
  text,
  primary,
  secondary,
}: {
  heading: string;
  text: ReactNode;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <aside className="border-t border-line pt-10" aria-labelledby="content-cta-heading">
      <h2 id="content-cta-heading" className="display-sm text-ink mb-4">
        {heading}
      </h2>
      <p className="body-lg text-graphite mb-8 max-w-2xl">{text}</p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button href={primary.href}>{primary.label}</Button>
        {secondary && (
          <Button href={secondary.href} variant="secondary">
            {secondary.label}
          </Button>
        )}
      </div>
    </aside>
  );
}
