import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { buildBreadcrumbJsonLd, jsonLdHtml, type BreadcrumbItem } from "@/lib/jsonLd";

/**
 * Gedeelde layout voor juridische pagina's (privacy, voorwaarden, cookies,
 * retour). Consistente, leesbare typografie (body ≥16px, line-height ≥1.6)
 * voor de brede doelgroep. Geen eigen <main>: die staat in app/layout.tsx.
 *
 * Geef `path` mee (bv. "/retourneren") voor het kruimelpad (Home > titel)
 * en het bijbehorende BreadcrumbList-schema; zonder `path` blijft dat weg.
 */

// Bijwerken wanneer een juridische tekst inhoudelijk wijzigt.
const LAST_UPDATED = "juli 2026";
export function LegalPage({
  title,
  intro,
  path,
  children,
}: {
  title: string;
  intro?: string;
  /** Canonieke route van deze pagina, bv. "/privacy". */
  path?: string;
  children: React.ReactNode;
}) {
  const breadcrumbs: BreadcrumbItem[] | null = path
    ? [
        { name: "Home", url: "/" },
        { name: title, url: path },
      ]
    : null;

  return (
    <div className="bg-paper">
      {breadcrumbs && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(buildBreadcrumbJsonLd(breadcrumbs)) }}
        />
      )}
      <div className="max-w-[760px] mx-auto px-6 sm:px-10 pt-28 lg:pt-32 pb-20 lg:pb-28">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-6" />}
        <p className="eyebrow-lg mb-4">Juridisch</p>
        <h1 className="font-serif text-4xl lg:text-5xl text-ink leading-[1.1] mb-6">{title}</h1>
        {intro && <p className="text-lg text-slate leading-[1.7] mb-8">{intro}</p>}

        <p className="mb-12 text-base text-slate">Laatst bijgewerkt: {LAST_UPDATED}</p>

        <div className="space-y-10 text-ink">{children}</div>

        <p className="mt-16 pt-8 border-t border-line text-base text-slate leading-[1.7]">
          Vragen? Neem gerust contact op via de{" "}
          <Link href="/contact" className="text-accent-dark underline underline-offset-2 hover:text-ink">
            contactpagina
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** Sectie met kop + inhoud, consistente ritmiek. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl text-ink leading-snug mb-3">{heading}</h2>
      <div className="space-y-3 text-base leading-[1.7] text-slate">{children}</div>
    </section>
  );
}
