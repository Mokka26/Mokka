import Link from "next/link";

/**
 * Gedeelde layout voor juridische pagina's (privacy, voorwaarden, cookies,
 * retour). Consistente, leesbare typografie (body ≥16px, line-height 1.65)
 * voor de brede doelgroep. De `concept`-melding maakt expliciet dat de tekst
 * vóór definitieve livegang juridisch gecontroleerd moet worden.
 */
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
    <main className="bg-paper">
      <div className="max-w-[760px] mx-auto px-6 sm:px-10 py-20 lg:py-28">
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate mb-4">Juridisch</p>
        <h1 className="font-serif text-4xl lg:text-5xl text-ink leading-[1.1] mb-6">{title}</h1>
        {intro && <p className="text-lg text-slate leading-[1.7] mb-8">{intro}</p>}

        <div
          role="note"
          className="border border-line bg-white px-5 py-4 mb-12 text-[15px] leading-[1.6] text-slate"
        >
          Dit is een conceptversie. De definitieve juridische tekst wordt vóór de
          officiële livegang door een jurist gecontroleerd en aangevuld.
        </div>

        <div className="space-y-10 text-ink">{children}</div>

        <p className="mt-16 pt-8 border-t border-line text-[15px] text-slate leading-[1.6]">
          Vragen? Neem gerust contact op via de{" "}
          <Link href="/contact" className="text-accent underline underline-offset-2">
            contactpagina
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

/** Sectie met kop + inhoud, consistente ritmiek. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl text-ink leading-snug mb-3">{heading}</h2>
      <div className="space-y-3 text-[16px] leading-[1.7] text-slate">{children}</div>
    </section>
  );
}
