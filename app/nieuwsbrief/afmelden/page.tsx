import Link from "next/link";
import type { Metadata } from "next";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { maskEmail } from "@/lib/email";
import { verifyUnsubscribe, type UnsubscribeOutcome } from "@/lib/newsletter-unsubscribe";
import { unsubscribeNewsletter } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Afmelden voor de nieuwsbrief — ${businessInfo.name}`,
  robots: { index: false, follow: false },
};

type View = UnsubscribeOutcome | "pending";

const COPY: Record<View, { title: string; body: string }> = {
  pending: {
    title: "Afmelden voor de nieuwsbrief",
    body: "Klik op de knop om je af te melden. Daarna ontvang je geen nieuwsbrief meer van ons. Berichten over een bestelling blijven gewoon komen.",
  },
  done: {
    title: "Je bent afgemeld",
    body: "Je ontvangt geen nieuwsbrief meer van ons. Toch weer interesse? Je kunt je altijd opnieuw aanmelden via het formulier onderaan elke pagina.",
  },
  invalid: {
    title: "Deze afmeldlink werkt niet",
    body: "De link is onvolledig of niet meer geldig. Stuur ons een mail of bel ons, dan melden we je meteen af.",
  },
  error: {
    title: "Er ging iets mis",
    body: "We konden je nu niet afmelden. Probeer het over een paar minuten opnieuw, of stuur ons een mail of bel ons.",
  },
};

const OUTCOMES: ReadonlyArray<UnsubscribeOutcome> = ["done", "invalid", "error"];

function isOutcome(v: string | undefined): v is UnsubscribeOutcome {
  return v !== undefined && (OUTCOMES as ReadonlyArray<string>).includes(v);
}

/** GET wijzigt niets: alleen de handtekening controleren en de knop tonen. */
export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string; done?: string }>;
}) {
  const { e, t, done } = await searchParams;
  const email = isOutcome(done) ? null : verifyUnsubscribe(e, t);
  const view: View = isOutcome(done) ? done : email ? "pending" : "invalid";
  const copy = COPY[view];
  const phoneLink = getPhoneLink();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
      <div className="bg-white border border-line p-12 sm:p-20 text-center max-w-2xl w-full">
        <p className="eyebrow mb-6">Nieuwsbrief</p>
        <h1 className="display-md text-ink mb-6">{copy.title}</h1>
        <p className="body-lg text-slate mb-10">
          {copy.body}
          {view === "pending" && email ? ` Het gaat om ${maskEmail(email)}.` : ""}
        </p>
        {view === "pending" && e && t ? (
          <form action={unsubscribeNewsletter} className="flex flex-wrap items-center justify-center gap-4">
            <input type="hidden" name="e" value={e} />
            <input type="hidden" name="t" value={t} />
            <button type="submit" className="btn-primary">
              Afmelden
            </button>
            <Link href="/" className="btn-link">
              Toch niet
            </Link>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/" className="btn-primary">
              Naar home
            </Link>
          </div>
        )}
        <p className="text-slate text-base mt-10">
          Vragen? Mail naar{" "}
          <a href={`mailto:${businessInfo.contact.email}`} className="text-ink underline underline-offset-4">
            {businessInfo.contact.email}
          </a>
          {phoneLink && businessInfo.contact.phoneFormatted ? (
            <>
              {" "}of bel{" "}
              <a href={phoneLink} className="text-ink underline underline-offset-4">
                {businessInfo.contact.phoneFormatted}
              </a>
            </>
          ) : null}
          .
        </p>
      </div>
    </div>
  );
}
