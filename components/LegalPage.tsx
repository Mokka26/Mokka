import Link from "next/link";

/**
 * Gedeelde layout voor juridische pagina's (privacy, voorwaarden, cookies,
 * retour). Consistente, leesbare typografie (body ≥16px, line-height ≥1.6)
 * voor de brede doelgroep. Geen eigen <main>: die staat in app/layout.tsx.
 */

// Bijwerken wanneer een juridische tekst inhoudelijk wijzigt.
const LAST_UPDATED = "juli 2026";
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-paper">
      <div className="max-w-[760px] mx-auto px-6 sm:px-10 pt-32 lg:pt-40 pb-20 lg:pb-28">
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
