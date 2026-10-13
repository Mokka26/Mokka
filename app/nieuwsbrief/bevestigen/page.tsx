import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { businessInfo, getPhoneLink } from "@/lib/business-info";
import { captureError } from "@/lib/sentry";
import { confirmNewsletterSubscription, type ConfirmOutcome } from "./actions";

// Zelfde regex als in actions.ts (48 hex-tekens = randomBytes(24)).
const CONFIRM_TOKEN_RE = /^[a-f0-9]{48}$/;

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Aanmelding bevestigen — ${businessInfo.name}`,
  robots: { index: false, follow: false },
};

type View = ConfirmOutcome | "pending";

const COPY: Record<View, { eyebrow: string; title: string; body: string }> = {
  pending: {
    eyebrow: "Nieuwsbrief",
    title: "Nog één klik",
    body: "Klik op de knop om je aanmelding voor de nieuwsbrief te bevestigen. Zonder bevestiging ontvang je niets van ons.",
  },
  confirmed: {
    eyebrow: "Welkom",
    title: "Je aanmelding is bevestigd",
    body: "Bedankt! Je ontvangt af en toe bericht over nieuwe collecties, showroomnieuws en aanbiedingen — niet vaker dan nodig.",
  },
  already: {
    eyebrow: "Nieuwsbrief",
    title: "Je staat al op de lijst",
    body: "Deze aanmelding was al bevestigd. Je hoeft verder niets te doen.",
  },
  invalid: {
    eyebrow: "Nieuwsbrief",
    title: "Deze link is niet (meer) geldig",
    body: "De bevestigingslink is verlopen of al gebruikt. Meld je gerust opnieuw aan via het formulier onderaan de pagina.",
  },
  error: {
    eyebrow: "Nieuwsbrief",
    title: "Er ging iets mis",
    body: "We konden je aanmelding nu niet bevestigen. Probeer het later opnieuw of neem contact met ons op.",
  },
};

const OUTCOMES: ReadonlyArray<ConfirmOutcome> = ["confirmed", "already", "invalid", "error"];

function isOutcome(v: string | undefined): v is ConfirmOutcome {
  return v !== undefined && (OUTCOMES as ReadonlyArray<string>).includes(v);
}

/**
 * GET wijzigt niets (alleen kijken of het token bestaat); de bevestiging zelf
 * gaat via de knop (POST → confirmNewsletterSubscription).
 */
async function lookup(token: string | undefined): Promise<View> {
  if (!token || !CONFIRM_TOKEN_RE.test(token)) return "invalid";
  try {
    const sub = await prisma.newsletterSubscriber.findUnique({
      where: { confirmToken: token },
      select: { confirmedAt: true, unsubscribedAt: true },
    });
    if (!sub) return "invalid";
    if (sub.confirmedAt && !sub.unsubscribedAt) return "already";
    return "pending";
  } catch (e) {
    captureError(e, { scope: "newsletterConfirm.lookup" });
    return "error";
  }
}

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const { token, done } = await searchParams;
  const view: View = isOutcome(done) ? done : await lookup(token);
  const copy = COPY[view];
  const phoneLink = getPhoneLink();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
      <div className="bg-white border border-line p-12 sm:p-20 text-center max-w-2xl w-full">
        <p className="eyebrow mb-6">{copy.eyebrow}</p>
        <h1 className="display-md text-ink mb-6">{copy.title}</h1>
        <p className="body-lg text-slate mb-10">{copy.body}</p>
        {view === "pending" && token ? (
          <form action={confirmNewsletterSubscription} className="flex flex-wrap items-center justify-center gap-4">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn-primary">
              Bevestig mijn aanmelding
            </button>
            <Link href="/" className="btn-link">
              Liever niet
            </Link>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/products" className="btn-primary">
              Bekijk de collectie
            </Link>
            <Link href="/" className="btn-link">
              Naar home
            </Link>
          </div>
        )}
        {phoneLink && businessInfo.contact.phoneFormatted && (
          <p className="text-stone text-sm mt-10">
            Vragen? Bel ons op{" "}
            <a href={phoneLink} className="text-ink underline underline-offset-4">
              {businessInfo.contact.phoneFormatted}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
